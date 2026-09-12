-- Пентест/обход UI 12.09: в курс можно было прикрепить ЧУЖОЙ урок.
-- Политика course_lessons_owner_all проверяет только владельца курса:
-- любой автор через прямой REST-запрос мог добавить в свой курс урок
-- другого автора (UI фильтрует «только свои», но сервер — нет).
-- Живой пример в БД: урок Ивана Петрова «React: от новичка до профи»
-- находился в курсе Дарины Богун «ИИ для Начинающих».
-- Фикс: owner_all дополнительно требует, чтобы урок принадлежал тому же автору.
-- Идемпотентно.

drop policy if exists course_lessons_owner_all on public.course_lessons;
create policy course_lessons_owner_all
  on public.course_lessons
  as permissive
  for all to authenticated
  using (
    exists (
      select 1 from courses c
      join coaches co on co.id = c.coach_id
      where c.id = course_lessons.course_id
        and co.user_id = auth.uid()
    )
    and exists (
      select 1 from lessons l
      join coaches co2 on co2.id = l.coach_id
      where l.id = course_lessons.lesson_id
        and co2.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses c
      join coaches co on co.id = c.coach_id
      where c.id = course_lessons.course_id
        and co.user_id = auth.uid()
    )
    and exists (
      select 1 from lessons l
      join coaches co2 on co2.id = l.coach_id
      where l.id = course_lessons.lesson_id
        and co2.user_id = auth.uid()
    )
  );

-- Чистка существующей связки «чужой урок в курсе» (на момент миграции — 1 строка):
-- удалённая связка не удаляет сам урок, только выводит его из чужого курса.
delete from public.course_lessons cl
where exists (
  select 1 from courses c
  join lessons l on l.id = cl.lesson_id
  where c.id = cl.course_id
    and l.coach_id <> c.coach_id
);

-- Проверки после запуска:
-- 1) select count(*) from course_lessons cl
--    join courses c on c.id = cl.course_id
--    join lessons l on l.id = cl.lesson_id
--    where l.coach_id <> c.coach_id;   -- должно быть 0
-- 2) policy course_lessons_owner_all содержит проверку владельца урока
--    (см. pg_policies).