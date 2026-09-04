-- Настройка автора «публиковать уроки ИИ-агента в HH:MM» (2026-09-04)
-- Часть фичи «ИИ-завод, агентская часть» (бэклог №2): агент работает когда
-- удобно (например, ночью), а урок выходит в свет в заданное автором время —
-- через отложенную публикацию lessons.publish_at (миграция 2026-09-03).
-- Хранение: колонка в coaches (null = агент решает сам, например публикует сразу).

alter table public.coaches
  add column if not exists ai_publish_time text;

-- Формат 'HH:MM' 00:00–23:59 или null; проверяет и UI, и API, но констрейнт —
-- последняя линия обороны (некорректное значение агент просто проигнорирует,
-- а мусор в базе не попадёт).
alter table public.coaches
  add constraint coaches_ai_publish_time_format
  check (ai_publish_time is null or ai_publish_time ~ '^([01]\d|2[0-3]):[0-5]\d$');

-- Проверка после выполнения:
-- select column_name from information_schema.columns
--   where table_name = 'coaches' and column_name = 'ai_publish_time';