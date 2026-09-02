-- Дроп устаревшего поля lessons.course_id
-- Дата: 2026-09-02
-- Контекст: переход на таблицу course_lessons (многие-ко-многим, 2026-09-02).
-- Поле lessons.course_id выведено из употребления (значения обнулены в предыдущей
-- миграции 2026-09-02-course-lessons.sql), код его не использует.
--
-- Версия 2: политика lessons_public_read ссылалась на course_id — сначала
-- пересоздаём её через course_lessons, затем дропаем колонку.

-- 1. Пересоздать публичное чтение: урок опубликован сам ИЛИ входит в опубликованный курс
drop policy if exists "lessons_public_read" on lessons;
create policy "lessons_public_read" on lessons
for select
using (
  is_published = true
  or exists (
    select 1 from course_lessons cl
    join courses c on c.id = cl.course_id
    where cl.lesson_id = lessons.id and c.is_published = true
  )
);

-- 2. Дропнуть устаревшее поле
alter table lessons drop column if exists course_id;