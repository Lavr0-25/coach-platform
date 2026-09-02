-- Миграция 2026-09-02: многие-ко-многим между курсами и уроками
-- Статус: к выполнению в Supabase Dashboard → SQL Editor
-- Запускать ДО обновления кода (код начинает читать course_lessons)
-- Ответственный: Анатолий (запуск) / Claude (автор скрипта)

-- 1. Связующая таблица: урок может быть в любом числе курсов
create table if not exists course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  -- один и тот же урок нельзя добавить в один курс дважды
  unique (course_id, lesson_id)
);

-- 2. Перенос существующих связей из lessons.course_id
insert into course_lessons (course_id, lesson_id, order_index)
select course_id, id, coalesce(order_index, 0)
from lessons
where course_id is not null
on conflict (course_id, lesson_id) do nothing;

-- 3. Старое поле больше не источник правды — обнуляем (столбец удалим позже, отдельной миграцией)
update lessons set course_id = null where course_id is not null;

-- Проверка: сколько связей перенеслось
select count(*) as перенесено_связей from course_lessons;