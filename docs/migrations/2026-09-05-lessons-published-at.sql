-- Фактическая дата публикации уроков (2026-09-05)
-- 1) published_at: когда урок реально открылся студентам — для карточек
--    «Мои уроки» (дата публикации) и статуса на странице урока.
--    Ставится и ручной публикацией (setLessonPublished), и планировщиком.
--    При снятии с публикации — null.
-- 2) Планировщик публикует и проставляет published_at = now().
-- 3) Бэкфилл: у уже опубликованных уроков фактический момент неизвестен —
--    берём updated_at как приближение.

-- 1) Колонка
alter table public.lessons
  add column if not exists published_at timestamptz;

-- 2) Бэкфилл для уже опубликованных
update public.lessons
set published_at = updated_at
where is_published = true and published_at is null;

-- 3) Пересоздаём job: публикация теперь проставляет и published_at
select cron.unschedule('publish-scheduled-lessons')
where exists (select 1 from cron.job where jobname = 'publish-scheduled-lessons');

select cron.schedule(
  'publish-scheduled-lessons',
  '* * * * *', -- каждую минуту
  $$
  update public.lessons
  set is_published = true, published_at = now(), updated_at = now()
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
-- select id, is_published, publish_at, published_at from public.lessons order by created_at desc limit 5;