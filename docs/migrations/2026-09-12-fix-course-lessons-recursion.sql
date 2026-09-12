-- Фикс: бесконечная рекурсия RLS на lessons (42P17) для залогиненных — 12.09
--
-- Симптом: у любого залогиненного пользователя (автор, админ, студент) все
-- запросы к lessons падали с "infinite recursion detected in policy for
-- relation \"lessons\"" — профили авторов пустые, «Мои материалы» пустые.
-- Гость не страдал: его ветка политики course_lessons не смотрит lessons.
--
-- Причина: миграция 2026-09-12-course-lessons-owner.sql добавила в политику
-- course_lessons_owner_all проверку владельца урока через прямую выборку из
-- lessons. Возникла петля: lessons_public_read → course_lessons →
-- course_lessons_owner_all → lessons → ...
--
-- Фикс: проверку владельца урока делаем через SECURITY DEFINER функцию
-- is_coach_of_lesson() (уже существовала, используется политиками
-- lesson_access) — внутри неё RLS не применяется, петля рвётся.
-- Семантика политики не меняется: владелец курса управляет связками только
-- со СВОИМИ уроками; чужой урок прикрепить нельзя; админ управляет всем
-- (course_lessons_admin_all).

drop policy if exists course_lessons_owner_all on public.course_lessons;

create policy course_lessons_owner_all
  on public.course_lessons
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      join public.coaches co on co.id = c.coach_id
      where c.id = course_lessons.course_id
        and co.user_id = auth.uid()
    )
    and public.is_coach_of_lesson(course_lessons.lesson_id)
  )
  with check (
    exists (
      select 1
      from public.courses c
      join public.coaches co on co.id = c.coach_id
      where c.id = course_lessons.course_id
        and co.user_id = auth.uid()
    )
    and public.is_coach_of_lesson(course_lessons.lesson_id)
  );

-- Проверка после применения (SQL Editor):
--   select policyname, qual from pg_policies
--   where tablename = 'course_lessons' and policyname = 'course_lessons_owner_all';
-- В qual должен быть вызов is_coach_of_lesson вместо выборки из lessons.