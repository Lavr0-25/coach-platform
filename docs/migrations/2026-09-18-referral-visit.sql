-- 2026-09-18. Статистика «Поделиться»: событие referral_visit (переход по
-- реферальной ссылке автора /?ref=<coach_user_id>).
--
-- Целевой тип переиспользуем 'profile' (target_id = coach_user_id — он же
-- реферальный код), поэтому CHECK target_type НЕ меняется — только
-- event_type и RLS-политика для гостя. Шаги применяются отдельно
-- (см. memory: lesson-event-type-blocked-rls-check).

-- Шаг 1. CHECK event_type: + 'referral_visit'
alter table analytics_events drop constraint analytics_events_event_type_check;
alter table analytics_events add constraint analytics_events_event_type_check
  check (event_type = any (array[
    'profile_view', 'lesson_view', 'course_view', 'lesson_start',
    'lesson_complete', 'catalog_impression', 'catalog_click', 'share',
    'referral_visit'
  ]));

-- Шаг 2. RLS: гость может записать только переход по ссылке, без привязки к себе
create policy analytics_anon_insert_referral_visit on analytics_events
  for insert to anon
  with check (user_id is null and event_type = 'referral_visit');