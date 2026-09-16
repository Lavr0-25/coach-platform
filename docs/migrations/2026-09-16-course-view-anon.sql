-- №30 (2026-09-16): гостевые просмотры курсов + видимость событий курса автору.
--
-- 1) analytics_anon_insert_views: к profile_view/lesson_view добавляется
--    course_view — анонимный читатель страницы курса тоже считается
--    (курс открыт, просмотра курса это событие уровня «охват»).
-- 2) «Mentors can view own analytics»: раньше автор видел только события
--    своих уроков — добавлена ветка course: события course_view своих
--    курсов (анонимные в том числе, фильтр только по target_id).
--
-- Идемпотентно: drop policy if exists перед каждым create.

drop policy if exists analytics_anon_insert_views on analytics_events;
create policy analytics_anon_insert_views on analytics_events
  for insert to anon
  with check (
    user_id is null
    and event_type in ('profile_view', 'lesson_view', 'course_view')
  );

drop policy if exists "Mentors can view own analytics" on analytics_events;
create policy "Mentors can view own analytics" on analytics_events
  for select to authenticated
  using (
    (target_type = 'profile' and target_id = auth.uid())
    or (
      target_type = 'lesson'
      and target_id in (
        select l.id from lessons l
        where l.coach_id in (
          select c.id from coaches c where c.user_id = auth.uid()
        )
      )
    )
    or (
      target_type = 'course'
      and target_id in (
        select co.id from courses co
        where co.coach_id in (
          select c.id from coaches c where c.user_id = auth.uid()
        )
      )
    )
  );