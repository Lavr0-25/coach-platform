-- Публикация по расписанию (2026-09-03)
-- Автор задаёт уроку publish_at; планировщик pg_cron каждую минуту открывает
-- уроки, у которых время наступило и контент непустой (то же правило, что и
-- у ручной публикации: пустой урок опубликовать нельзя — он остаётся черновиком).
-- pg_cron работает от postgres и обходит RLS — это ок: job меняет только
-- is_published/publish_at по служебному условию.

-- 1) Колонка с моментом публикации (null = расписание не задано)
alter table public.lessons
  add column if not exists publish_at timestamptz;

-- 2) Планировщик: каждую минуту
create extension if not exists pg_cron;

-- Пересоздаём job идемпотентно (повторный запуск миграции не плодит дубли)
select cron.unschedule('publish-scheduled-lessons')
where exists (select 1 from cron.job where jobname = 'publish-scheduled-lessons');

select cron.schedule(
  'publish-scheduled-lessons',
  '* * * * *', -- каждую минуту
  $$
  update public.lessons
  set is_published = true, updated_at = now()
  where publish_at is not null
    and is_published = false
    and publish_at <= now()
    and exists (
      select 1 from public.lesson_content lc
      where lc.lesson_id = public.lessons.id
        and (
          (lc.content_type = 'text'
            and length(regexp_replace(coalesce(lc.content_html, ''), '<[^>]*>', '', 'g')) > 0)
          or (lc.content_type <> 'text'
            and length(coalesce(lc.content_url, '')) > 0)
        )
    )
  $$
);

-- Проверка после выполнения:
-- select jobname, schedule, active from cron.job;