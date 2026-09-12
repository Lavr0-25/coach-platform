-- ============================================================================
-- Ф3: Платные подписки на автора — серверная часть (RightWay / coach-platform)
-- Дата: 2026-09-11 · Спека: docs/specs/payments.md (раздел Ф3) · Статус: НА СОГЛАСОВАНИЕ
-- Применяет: Анатолий в SQL Editor Supabase (MCP-коннект агента read-only)
-- Идемпотентность: повторный запуск безопасен (IF NOT EXISTS / DO-блоки).
--
-- Что делает:
--   1) статус 'pending' («ожидает оплаты») в CHECK paid_subscriptions;
--   2) таблица subscription_payments — журнал списаний по подписке
--      (как purchases для разовых покупок); inv_id уникальный = идемпотентность
--      вебхука; клиентской INSERT-политики нет (пишет только сервер);
--   3) pg_cron job «expire-paid-subscriptions»: раз в час помечает expired.
--
-- Конвенции Ф1 сохранены: FK-констрейнтов нет; coach_user_id = auth user_id
-- автора; админ-проверка в RLS через coaches.role = 'admin'.
-- ============================================================================


-- ============================================================================
-- Блок 1. Статус 'pending' в CHECK paid_subscriptions
-- ============================================================================
-- Жизненный цикл Ф3: pending (создан платёж, ждёт вебхук) → active (оплачен)
-- → cancelled (ученик отменил, доступ до period_end) → expired (period_end прошёл).
-- Продление: не-active строка пары переиспользуется (снова pending).
-- Констрейнт из Ф1 был создан без имени (auto) — снимаем ВСЕ check-констрейнты
-- на колонке status и ставим свой именованный, чтобы повторный запуск не падал.
DO $$
DECLARE con text;
BEGIN
  FOR con IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'public.paid_subscriptions'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.paid_subscriptions DROP CONSTRAINT %I', con);
  END LOOP;
END $$;

ALTER TABLE public.paid_subscriptions ADD CONSTRAINT paid_subscriptions_status_check
  CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'past_due'));


-- ============================================================================
-- Блок 2. Таблица subscription_payments (журнал списаний)
-- ============================================================================
-- Одна строка = один платёж Robokassa по подписке (первый, продление 6/12 мес).
-- Зеркало purchases из Ф2: сумма, комиссия платформы, роялти автору, inv_id.
-- period_months — на сколько месяцев оплачен этот платёж (вебхук прибавит
-- их к period_end подписки). paid_at — момент подтверждения вебхуком.
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,    -- строка paid_subscriptions
  user_id uuid NOT NULL,            -- студент (auth.users)
  coach_user_id uuid NOT NULL,      -- автор (auth.users)
  amount numeric NOT NULL,
  platform_commission numeric NOT NULL,
  coach_earnings numeric NOT NULL,
  period_months integer NOT NULL CHECK (period_months IN (1, 6, 12)),
  inv_id text,                      -- идентификатор платежа Robokassa
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Уникальность inv_id = идемпотентность вебхука (повторный вызов отвечает OK,
-- не создавая дубль). Частичный индекс — NULL-строки не мешают друг другу.
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_inv_uniq
  ON public.subscription_payments (inv_id) WHERE inv_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_payments_sub_idx
  ON public.subscription_payments (subscription_id);
CREATE INDEX IF NOT EXISTS subscription_payments_coach_idx
  ON public.subscription_payments (coach_user_id, created_at DESC);

-- RLS: читать — студент этой подписки, автор и админ. INSERT/UPDATE клиентом
-- НЕТ (платёж подтверждает только вебхук через сервисный ключ) — как в
-- paid_subscriptions и audit_log.
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_payments_user_select" ON public.subscription_payments;
CREATE POLICY "sub_payments_user_select" ON public.subscription_payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sub_payments_coach_select" ON public.subscription_payments;
CREATE POLICY "sub_payments_coach_select" ON public.subscription_payments
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "sub_payments_admin_all" ON public.subscription_payments;
CREATE POLICY "sub_payments_admin_all" ON public.subscription_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 3. pg_cron: истёкшие подписки → expired (раз в час)
-- ============================================================================
-- active и cancelled с прошедшим period_end закрываем (у cancelled доступ был
-- до конца оплаченного периода — теперь он прошёл). Шаблон 2026-09-03.
create extension if not exists pg_cron;

select cron.unschedule('expire-paid-subscriptions')
where exists (select 1 from cron.job where jobname = 'expire-paid-subscriptions');

select cron.schedule(
  'expire-paid-subscriptions',
  '17 * * * *', -- раз в час, на 17-й минуте (вне ровных часов — меньше шума)
  $$
  update public.paid_subscriptions
  set status = 'expired', updated_at = now()
  where status in ('active', 'cancelled')
    and period_end < now()
  $$
);


-- ============================================================================
-- Блок 4. Проверка после применения (запустите отдельно)
-- ============================================================================
-- 1) Констрейнт статуса принимает pending:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.paid_subscriptions'::regclass AND conname = 'paid_subscriptions_status_check';
-- Ожидаем: CHECK (status IN ('pending','active','cancelled','expired','past_due')).
--
-- 2) Новая таблица с RLS:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('subscription_payments');
-- Ожидаем relrowsecurity = true.
--
-- 3) Политики (SELECT ученик/автор/админ, INSERT/UPDATE клиенту нет):
-- SELECT policy_name, cmd FROM pg_policies WHERE tablename = 'subscription_payments';
-- Ожидаем 3 строки, все SELECT.
--
-- 4) pg_cron job:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-paid-subscriptions';
-- Ожидаем 1 строку, '17 * * * *'.