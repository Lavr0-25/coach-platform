-- №20 «Отложенные посты через Vercel», 2026-09-13
-- Запускать от postgres (SQL Editor) — обходит RLS.
-- Что добавляется:
--   1. Расширение pg_net — HTTP-запросы из pg_cron (пинг Vercel-функции).
--   2. Таблица scheduled_posts — очередь постов в соцсети: контент-завод
--      (агентский API /api/agent/scheduled-posts) кладёт пост, Vercel-функция
--      /api/cron/publish-scheduled публикует в Telegram по расписанию.
--   3. pg_cron-задача: каждые 15 минут пингует Vercel-функцию (на бесплатном
--      тарифе Vercel встроенный cron ходит раз в сутки — там же резервный догон).
--
-- ⚠️ В секции 4 замените ЗАМЕНИ_НА_СЕКРЕТ на реальный секрет (тот же надо
--    добавить в Vercel → Settings → Environment Variables → CRON_SECRET).

begin;

-- 1. pg_net: HTTP из базы
create extension if not exists pg_net;

-- 2. Очередь постов
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  channel text not null default 'tg',            -- пока только Telegram (VK — №21)
  text text not null,
  photo_url text,                                -- публичный URL в бакете covers
  status text not null default 'pending'
    check (status in ('pending','publishing','published','failed','cancelled')),
  publish_at timestamptz not null,
  published_at timestamptz,
  external_message_id bigint,                    -- message_id в Telegram
  attempts int not null default 0,               -- попыток публикации (>= 3 → failed)
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scheduled_posts is
  'Очередь постов в соцсети (№20). pending → publishing → published/failed; publishing = взят публикацией.';

-- Индекс под запрос публикации (pending + срок <= сейчас)
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (status, publish_at);

-- 3. RLS: автор управляет своими постами, админ — всеми.
--    Проверка роли через coaches (не через саму таблицу) — рекурсии RLS нет.
alter table public.scheduled_posts enable row level security;

drop policy if exists "posts_coach_select" on public.scheduled_posts;
create policy "posts_coach_select" on public.scheduled_posts
  for select to authenticated
  using (
    exists (
      select 1 from public.coaches c
      where c.id = scheduled_posts.coach_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "posts_coach_insert" on public.scheduled_posts;
create policy "posts_coach_insert" on public.scheduled_posts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.coaches c
      where c.id = scheduled_posts.coach_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "posts_coach_update" on public.scheduled_posts;
create policy "posts_coach_update" on public.scheduled_posts
  for update to authenticated
  using (
    exists (
      select 1 from public.coaches c
      where c.id = scheduled_posts.coach_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "posts_admin_all" on public.scheduled_posts;
create policy "posts_admin_all" on public.scheduled_posts
  for all to authenticated
  using (
    exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

commit;

-- 4. pg_cron: пинг Vercel-функции каждые 15 минут.
--    ⚠️ Подставьте свой секрет вместо ЗАМЕНИ_НА_СЕКРЕТ (и он же — в Vercel env CRON_SECRET).
--    Запускать ВНЕ транзакции (cron.schedule сам коммитит).
select cron.unschedule('publish-scheduled-posts')
where exists (select 1 from cron.job where jobname = 'publish-scheduled-posts');

select cron.schedule(
  'publish-scheduled-posts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://www.myrightway.ru/api/cron/publish-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'ЗАМЕНИ_НА_СЕКРЕТ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Контроль (после применения):
--   select jobid, schedule, command from cron.job where jobname = 'publish-scheduled-posts';
--   \d scheduled_posts  — или в Table Editor: таблица с колонками id..updated_at.
-- Тест пинга вручную (в SQL Editor, после подстановки секрета):
--   select net.http_post(
--     url := 'https://www.myrightway.ru/api/cron/publish-scheduled',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','ВАШ_СЕКРЕТ'),
--     body := '{}'::jsonb);
-- Ответ функции смотреть в Vercel → Logs (роут /api/cron/publish-scheduled).