-- №Б (2026-09-18): событие 'share' для кнопки «Поделиться» + возврат course_view.
-- Урок 17.09: новые event_type блокируются на 3 уровнях — RLS-политика,
-- CHECK event_type, CHECK target_type. Шаги применяются по отдельности.
--
-- ⚠️ ВАЖНО (найдено при применении 18.09): текущий CHECK в проде НЕ содержал
-- course_view — миграция 17.09 (CTR-подсказки) пересоздала ограничение по
-- старому списку, и все course_view молча отклонялись (в таблице 0 событий).
-- Скрипт возвращает course_view и добавляет share одним шагом.
-- ПРИМЕНЕНО 2026-09-18 (SQL-редактор Supabase, Анатолий).

-- Шаг 1: расширить CHECK event_type: вернуть 'course_view' + добавить 'share'
-- (target_type 'profile'/'lesson'/'course' уже разрешены — CHECK не трогаем).
ALTER TABLE analytics_events
  DROP CONSTRAINT analytics_events_event_type_check;
ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_event_type_check
  CHECK (event_type IN (
    'profile_view', 'lesson_view', 'course_view', 'lesson_start',
    'lesson_complete', 'catalog_impression', 'catalog_click', 'share'
  ));

-- Шаг 2: гостям тоже можно логировать «Поделиться» (гость шарит урок —
-- событие с user_id IS NULL). Отдельная политика, не трогаем существующие.
CREATE POLICY analytics_anon_insert_share
  ON analytics_events
  FOR INSERT TO anon
  WITH CHECK ((user_id IS NULL) AND (event_type = 'share'));

-- Залогиненные уже могут: analytics_insert_own (user_id = auth.uid()).
-- Проверка после применения:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'analytics_events'::regclass
--      AND conname = 'analytics_events_event_type_check';  -- в списке есть 'share'
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'analytics_events'
--      AND policyname = 'analytics_anon_insert_share';     -- 1 строка