-- Миграция 2026-09-17: заявки на вывод средств (кошелёк ментора).
-- Оферта п. 6.5: минимум для вывода 1 000 ₽; выплата вручную с р/с ООО,
-- не автоперевод. Баланс считается приложением: completed-роялти
-- (purchases + subscription_payments) минус оплаченные и ожидающие заявки.
--
-- Часть 1. Таблица заявок: ментор запрашивает вывод, админ отмечает результат.
--   UNIQUE-индекс гарантирует не более одной активной (pending) заявки у ментора.
--   receipt_number — номер чека «Мой налог», заполняет админ при выплате.
--   admin_note — причина отказа (статус rejected).
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL REFERENCES public.coaches (user_id),
  amount numeric(10,2) NOT NULL CHECK (amount >= 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'rejected')),
  receipt_number text,
  admin_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_pending_idx
  ON public.payout_requests (coach_user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS payout_requests_coach_idx
  ON public.payout_requests (coach_user_id);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Ментор видит только свои заявки.
DROP POLICY IF EXISTS "payouts_coach_select" ON public.payout_requests;
CREATE POLICY "payouts_coach_select" ON public.payout_requests
  FOR SELECT USING (auth.uid() = coach_user_id);

-- Ментор создаёт заявку на себя (серверный action проверяет баланс и реквизиты).
DROP POLICY IF EXISTS "payouts_coach_insert" ON public.payout_requests;
CREATE POLICY "payouts_coach_insert" ON public.payout_requests
  FOR INSERT WITH CHECK (auth.uid() = coach_user_id);

-- Админ видит все заявки.
DROP POLICY IF EXISTS "payouts_admin_select" ON public.payout_requests;
CREATE POLICY "payouts_admin_select" ON public.payout_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.coaches c
            WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );

-- Админ обрабатывает заявку (paid/rejected).
DROP POLICY IF EXISTS "payouts_admin_update" ON public.payout_requests;
CREATE POLICY "payouts_admin_update" ON public.payout_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.coaches c
            WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );

-- Часть 2. Уведомления: тип 'payout' — ментору о результате заявки
-- (выплачено / отклонено) и подтверждение приёма заявки.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
CHECK ((type = ANY (ARRAY['new_comment'::text, 'new_reply'::text, 'mentor_reply'::text, 'new_message'::text, 'ban'::text, 'comment_deleted'::text, 'review_deleted'::text, 'achievement'::text, 'referral'::text, 'commission'::text, 'payout'::text])));

-- Верификация (после применения):
--   1) select * from pg_tables where tablename='payout_requests';
--   2) select policyname from pg_policies where tablename='payout_requests';
--      -- должно быть 4 политики
--   3) select pg_get_constraintdef(oid) from pg_constraint
--      where conname='payout_requests_status_check';
--      -- должно содержать 'pending', 'paid', 'rejected' и amount >= 1000
--   4) select pg_get_constraintdef(oid) from pg_constraint
--      where conname='notifications_type_check'; -- должен быть 'payout'