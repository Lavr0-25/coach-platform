-- ============================================================================
-- Опрос аудитории: таблица ответов /survey (RightWay / coach-platform)
-- Дата: 2026-09-11 · Спека: docs/specs/survey.md · Статус: stable
-- Применяет: агент через MCP execute_sql (идемпотентно).
--
-- Назначение: разовый опрос разведки B2B-LMS (13 вопросов, ссылки на аудиторию
-- через coach-platform-pi.vercel.app/survey). Не конструктор опросов — это
-- бэклог №22, отдельная работа.
--
-- Конвенции проекта (по 2026-09-10-payments-f1.sql):
--  - FK-констрейнтов не добавляем (целостность на уровне приложения).
--  - Админ-проверка в RLS: exists (select 1 from coaches c
--    where c.user_id = auth.uid() and c.role = 'admin').
--
-- Приватность (152-ФЗ): сырой IP НЕ храним — только sha256(ip + соль).
-- user_agent — только для отсева ботов при анализе, персональных данных
-- не содержит. Соль — env SURVEY_SALT (Vercel + .env.local).
-- ============================================================================


-- ============================================================================
-- Блок 1. Таблица survey_responses
-- ============================================================================
-- answers jsonb — ВСЕ ответы одной отправки (ключи q0…q12, см. спеку).
-- Одна строка = один респондент. Валидация значений — в server action
-- (app/survey/actions.ts, whitelist по каждому вопросу), CHECK в БД не даём:
-- форма опроса меняется, jsonb не должен ломать старые строки.
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL,
  ip_hash text,
  user_agent text
);

-- Индекс для анти-спам-проверки (недавние отправки с одного ip_hash).
CREATE INDEX IF NOT EXISTS survey_responses_ip_created_idx
  ON public.survey_responses (ip_hash, created_at);


-- ============================================================================
-- Блок 2. RLS
-- ============================================================================
-- Клиентская INSERT-политика НЕ даётся намеренно (как audit_log /
-- paid_subscriptions): запись идёт только через server action с сервисным
-- ключом (createAdminClient), где валидация и анти-спам сделаны руками.
-- SELECT — только админ. Аноним не читает ничего.
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "survey_admin_select" ON public.survey_responses;
CREATE POLICY "survey_admin_select" ON public.survey_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.role = 'admin'
    )
  );


-- ============================================================================
-- Проверка после применения
-- ============================================================================
-- 1) select * from public.survey_responses limit 1;      -- таблица существует
-- 2) select relrowsecurity from pg_class
--    where relname = 'survey_responses';                 -- relrowsecurity = true
-- 3) select count(*) from pg_policies
--    where tablename = 'survey_responses';               -- 1 (survey_admin_select)
-- 4) Анонимная вставка должна падать с "new row violates row-level security":
--    select set_config('role', 'anon', true);
--    insert into public.survey_responses (answers) values ('{}');
--    reset role;