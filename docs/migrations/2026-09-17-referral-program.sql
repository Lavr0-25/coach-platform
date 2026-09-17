-- Миграция 2026-09-17: реферальная программа авторов + тип уведомления о комиссии
-- (№32 + №33 бэклога; оферта v1.2 п. 5.4 и п. 5.3 становятся исполняемыми).
--
-- Часть 1. Таблица реферальных регистраций: кто кого привёл.
--   Один пользователь может привести только одного автора (UNIQUE referred_user_id).
--   Записи создаёт только серверный код (createAdminClient) — INSERT-политики нет.
--   ip — сигнал антифрода (спека payments.md), пишется приложением если доступен.
CREATE TABLE IF NOT EXISTS public.referral_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL REFERENCES public.coaches (user_id),
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id),
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_registrations_coach_idx
  ON public.referral_registrations (coach_user_id);

ALTER TABLE public.referral_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_coach_select" ON public.referral_registrations;
CREATE POLICY "referrals_coach_select" ON public.referral_registrations
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "referrals_admin_select" ON public.referral_registrations;
CREATE POLICY "referrals_admin_select" ON public.referral_registrations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.coaches c
            WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );

-- Часть 2. Уведомления о ставке комиссии и рефералах.
-- notifications.type имеет CHECK — расширяем двумя типами:
--   referral   — автору: по его ссылке зарегистрировался новый пользователь;
--   commission — админ изменил индивидуальную ставку автора.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
CHECK ((type = ANY (ARRAY['new_comment'::text, 'new_reply'::text, 'mentor_reply'::text, 'new_message'::text, 'ban'::text, 'comment_deleted'::text, 'review_deleted'::text, 'achievement'::text, 'referral'::text, 'commission'::text])));

-- Часть 3. Настройка размера реферального бенефита (п. 5.4 оферты: 5 п.п.).
-- Кладёт приложение при первом запуске; дальше админ может менять.
INSERT INTO public.system_settings (key, value)
  SELECT 'referral_discount_pp', '{"pp": 5}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.system_settings WHERE key = 'referral_discount_pp'
  );

-- Верификация (после применения):
--   1) select * from pg_tables where tablename='referral_registrations';
--   2) select key, value from system_settings where key='referral_discount_pp';
--   3) select pg_get_constraintdef(oid) from pg_constraint
--      where conname='notifications_type_check';