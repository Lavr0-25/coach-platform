-- ============================================================================
-- Ф1: Фундамент данных для платежей (RightWay / coach-platform)
-- Дата: 2026-09-10 · Спека: docs/specs/payments.md · Статус: НА СОГЛАСОВАНИЕ
-- Применяет: Анатолий в SQL Editor Supabase (MCP-коннект агента read-only)
-- Идемпотентность: повторный запуск безопасен (IF NOT EXISTS / WHERE NOT EXISTS),
-- кроме RENAME (см. блок 5) — он на втором запуске даст ошибку "already exists".
--
-- Юрформа (ООО/самозанятый/ИП) на эту миграцию НЕ влияет — она про структуру
-- данных. Юрформа понадобится только в Ф6 (оферты) и при регистрации Robokassa.
--
-- Конвенции, снятые с реальной схемы 2026-09-10:
--  - FK-констрейнтов в схеме нет (целостность на уровне приложения) — не добавляем.
--  - В бесплатных subscriptions.coach_id хранится auth user_id автора (4/4 строк),
--    а НЕ coaches.id — платная таблица идёт по той же конвенции (coach_user_id).
--  - Админ-проверка в RLS: exists (select 1 from coaches c
--    where c.user_id = auth.uid() and c.role = 'admin').
-- ============================================================================


-- ============================================================================
-- Блок 1. Флаги платного контента на уроках и курсах
-- ============================================================================
-- in_subscription: материал входит в платную подписку автора.
-- Дефолт false = «всё бесплатно», платный доступ включается только осознанно.
-- Ментор управляет этим флагом сам через существующие политики
-- lessons_owner_update / coaches_update_own: без Ф2 флаг ни на что не влияет.
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS in_subscription boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS in_subscription boolean NOT NULL DEFAULT false;


-- ============================================================================
-- Блок 2. Поля ментора для платной подписки
-- ============================================================================
-- subscription_price: цена подписки в руб/мес. NULL = подписка не настроена.
-- Диапазон из спеки: 99–9990 ₽ (CHECK не даёт ввести мусор или цену 0).
-- paid_publishing_allowed: право продавать платный контент. Дефолт FALSE —
-- «рубильник» спеки. ВКЛЮЧАЕТ ТОЛЬКО АДМИН (см. триггер ниже): существующая
-- политика coaches_update_own позволяет ментору менять все свои колонки,
-- и без триггера ментор мог бы включить рубильник себе сам — обходим это.
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS subscription_price numeric,
  ADD COLUMN IF NOT EXISTS paid_publishing_allowed boolean NOT NULL DEFAULT false;

ALTER TABLE public.coaches DROP CONSTRAINT IF EXISTS coaches_subscription_price_range;
ALTER TABLE public.coaches ADD CONSTRAINT coaches_subscription_price_range
  CHECK (subscription_price IS NULL OR (subscription_price >= 99 AND subscription_price <= 9990));

-- Триггер: менять paid_publishing_allowed может только админ.
-- Ментор, меняющий другие свои поля (bio, price и т.д.), не задевает рубильник.
CREATE OR REPLACE FUNCTION public.enforce_paid_publishing_admin_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.paid_publishing_allowed IS DISTINCT FROM OLD.paid_publishing_allowed)
     AND NOT EXISTS (
       SELECT 1 FROM coaches c
       WHERE c.user_id = auth.uid() AND c.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Изменение paid_publishing_allowed доступно только администратору';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coaches_paid_publishing_guard ON public.coaches;
CREATE TRIGGER coaches_paid_publishing_guard
  BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_paid_publishing_admin_only();


-- ============================================================================
-- Блок 3. Таблица платных подписок (paid_subscriptions)
-- ============================================================================
-- Отдельно от бесплатной subscriptions — её не трогаем.
-- coach_user_id = auth user_id автора (та же конвенция, что в subscriptions).
-- status: active / cancelled / expired / past_due (по терминологии Robokassa).
-- price — снимок цены на момент оплаты: ментор поднял цену, у активных
-- подписчиков остаётся старая до конца оплаченного периода.
-- period_end — по нему pg_cron в Ф2 будет помечать протухшие как expired.
-- Частичный уникальный индекс: одна активная подписка на пару (студент, автор).
CREATE TABLE IF NOT EXISTS public.paid_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,            -- студент (auth.users)
  coach_user_id uuid NOT NULL,      -- автор (auth.users, как в subscriptions)
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  price numeric NOT NULL,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL,
  inv_id text,                      -- идентификатор подписочного платежа Robokassa
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paid_subscriptions_user_idx ON public.paid_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS paid_subscriptions_coach_idx ON public.paid_subscriptions (coach_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS paid_subscriptions_active_uniq
  ON public.paid_subscriptions (user_id, coach_user_id) WHERE status = 'active';

-- RLS: читать — владелец подписки, автор и админ; писать — только админ и
-- сервисный ключ (вебхук Ф2 работает через service role, который RLS обходит).
-- Клиентская INSERT-политика не даётся намеренно: подписки создаются только
-- после реального платежа, не руками из браузера.
ALTER TABLE public.paid_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paid_subs_user_select" ON public.paid_subscriptions;
CREATE POLICY "paid_subs_user_select" ON public.paid_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "paid_subs_coach_select" ON public.paid_subscriptions;
CREATE POLICY "paid_subs_coach_select" ON public.paid_subscriptions
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "paid_subs_admin_all" ON public.paid_subscriptions;
CREATE POLICY "paid_subs_admin_all" ON public.paid_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 4. Таблица комиссионных бенефитов (commission_benefits)
-- ============================================================================
-- Реферальные бенефиты: временная скидка автору на комиссию платформы
-- (−10 п.п. на 3 мес — значения кладёт приложение, таблица — только рамка).
-- discount_pp — величина в процентных пунктах (10.00 = минус 10 п.п.).
-- revoked_at — клосбэк при возврате/фейке реферала (NULL = действует).
-- Действующий бенефит: revoked_at IS NULL AND (expires_at IS NULL OR now() < expires_at).
CREATE TABLE IF NOT EXISTS public.commission_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL,      -- кому бенефит (auth user_id)
  discount_pp numeric NOT NULL CHECK (discount_pp > 0 AND discount_pp <= 50),
  source text NOT NULL DEFAULT 'referral',  -- referral / manual
  note text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS commission_benefits_coach_idx ON public.commission_benefits (coach_user_id);

-- RLS: автор видит свои бенефиты, админ управляет всеми.
ALTER TABLE public.commission_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "benefits_coach_select" ON public.commission_benefits;
CREATE POLICY "benefits_coach_select" ON public.commission_benefits
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "benefits_admin_all" ON public.commission_benefits;
CREATE POLICY "benefits_admin_all" ON public.commission_benefits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 5. Журналы: audit_log + activity_events
-- ============================================================================
-- audit_log — КТО что изменил в деньгах (ставки, рубильники, бенефиты).
-- Пишут админ-действия и сервер (service role обходит RLS). Клиенты пишут НЕ могут.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,               -- кто (NULL = системное действие)
  action text NOT NULL,             -- напр. 'commission_updated', 'publishing_allowed_on'
  entity text NOT NULL,             -- напр. 'coaches', 'system_settings'
  entity_id text,                   -- uuid строкой или ключ настройки
  details jsonb,                    -- что именно изменилось (was/becomes)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity, entity_id);

-- activity_events — факты действий пользователей для аналитики/ретенции
-- (логин, покупка стартовала, открыл платный урок). Пишем с клиента и с сервера.
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_user_idx ON public.activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_type_idx ON public.activity_events (event_type, created_at DESC);

-- RLS: audit_log — только админ читает, никто из клиентов не пишет.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_all" ON public.audit_log;
CREATE POLICY "audit_admin_all" ON public.audit_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );

-- RLS: activity_events — свой факт записать можно, читать — только админ.
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_insert_own" ON public.activity_events;
CREATE POLICY "activity_insert_own" ON public.activity_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "activity_admin_select" ON public.activity_events;
CREATE POLICY "activity_admin_select" ON public.activity_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 6. Глобальная ставка комиссии в system_settings
-- ============================================================================
-- system_settings уже существует (key text + value jsonb), политики: public
-- read + admin update. Не хватает INSERT-политики — добавляем, иначе первую
-- строку ставки не вставить (adмин-update без insert не создаёт строки).
DROP POLICY IF EXISTS "settings_admin_insert" ON public.system_settings;
CREATE POLICY "settings_admin_insert" ON public.system_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );

-- Стартовое значение из спеки: глобальная комиссия 30%.
-- WHERE NOT EXISTS делает вставку идемпотентной (повторный запуск не дублирует).
INSERT INTO public.system_settings (key, value)
  SELECT 'platform_commission', '{"percent": 30}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.system_settings WHERE key = 'platform_commission'
  );


-- ============================================================================
-- Блок 7. Чистка purchases: prodamus_order_id → inv_id
-- ============================================================================
-- Требование Ф2 (идемпотентность вебхука): Robokassa присылает inv_id, вебхук
-- по нему ищет «этот платёж уже обработан?». Переименование безопасно: код на
-- prodamus_order_id не ссылается (проверено grep по проекту, 2026-09-10).
-- ВНИМАНИЕ: этот блок на повторном запуске даст ошибку "column does not exist"
-- — это нормально, значит миграция уже применена.
ALTER TABLE public.purchases RENAME COLUMN prodamus_order_id TO inv_id;

-- Уникальность inv_id: защита от задвоения вебхука. Частичный индекс —
-- старые строки с NULL inv_id не мешают друг другу.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_inv_uniq
  ON public.purchases (inv_id) WHERE inv_id IS NOT NULL;


-- ============================================================================
-- Блок 8. Проверка после применения (запустите отдельно, всё должно вернуть
-- строки/значения без ошибок)
-- ============================================================================
-- 1) Новые колонки:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name IN ('lessons','courses','coaches')
--    AND column_name IN ('in_subscription','subscription_price','paid_publishing_allowed');
-- Ожидаем 4 строки.
--
-- 2) Новые таблицы:
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public' AND table_name IN ('paid_subscriptions','commission_benefits','audit_log','activity_events');
-- Ожидаем 4 строки.
--
-- 3) Ставка:
-- SELECT value FROM system_settings WHERE key='platform_commission';
-- Ожидаем {"percent": 30}.
--
-- 4) Переименование:
-- SELECT column_name FROM information_schema.columns WHERE table_name='purchases' AND column_name='inv_id';
-- Ожидаем 1 строку.
--
-- 5) Триггер-рубильник (логика): под админом UPDATE coaches SET paid_publishing_allowed=true WHERE ... — пройдёт;
--    под ментором — ошибка "только администратору". Проверим в Ф2 через UI-тест.
--
-- 6) RLS включён на всех новых таблицах:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('paid_subscriptions','commission_benefits','audit_log','activity_events');
-- Ожидаем relrowsecurity = true у всех четырёх.