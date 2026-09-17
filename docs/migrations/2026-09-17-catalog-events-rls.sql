-- 2026-09-17: показы и CTR каталога (события catalog_impression / catalog_click)
--
-- Контекст: карточки материалов на главной получили трекинг показов
-- (IntersectionObserver, один раз за сессию) и кликов. События пишутся в
-- analytics_events с event_type 'catalog_impression' и 'catalog_click',
-- user_id = null (анонимно, боты отфильтрованы клиентом).
--
-- Проблема: три барьера на пути записи каталог-событий:
-- 1) политика analytics_anon_insert_views разрешает анониму вставку только
--    profile_view / lesson_view / course_view → отдельная политика;
-- 2) CHECK-констрейнт analytics_events_event_type_check держит белый список
--    event_type (profile_view / lesson_view / lesson_start / lesson_complete);
-- 3) CHECK-констрейнт analytics_events_target_type_check держит список
--    target_type (profile / lesson) — карточкам курсов нужен 'course'.
--
-- Фикс: отдельная политика для каталог-событий (user_id IS NULL и event_type
-- строго из двух допустимых — прочие типы от анонима по-прежнему не пройдут;
-- залогиненные пишут через analytics_insert_own, её не трогаем) + расширение
-- обоих CHECK-списков. CHECK пересоздаётся: validate-скан по пустой категории
-- (строк с новыми типами ещё нет) — мгновенно.
--
-- Проверка после применения (SQL Editor):
--   1) select count(*) from analytics_events
--      where event_type in ('catalog_impression','catalog_click');
--      → 0 (старых нет, это норма).
--   2) Открыть главную сайта (свежая сессия браузера) — в таблице появляются
--      catalog_impression по видимым карточкам (lesson И course); клик по
--      карточке → catalog_click.
--   3) Попытка вставить event_type = 'hack' от анонима (вставкой из консоли)
--      → отклоняется (CHECK).

create policy analytics_anon_insert_catalog on analytics_events
  for insert
  to anon
  with check (
    user_id is null
    and event_type in ('catalog_impression', 'catalog_click')
  );

alter table analytics_events
  drop constraint analytics_events_event_type_check;

alter table analytics_events
  add constraint analytics_events_event_type_check
  check (event_type = any (array[
    'profile_view'::text,
    'lesson_view'::text,
    'lesson_start'::text,
    'lesson_complete'::text,
    'catalog_impression'::text,
    'catalog_click'::text
  ]));

alter table analytics_events
  drop constraint analytics_events_target_type_check;

alter table analytics_events
  add constraint analytics_events_target_type_check
  check (target_type = any (array[
    'profile'::text,
    'lesson'::text,
    'course'::text
  ]));