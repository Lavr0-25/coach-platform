-- ============================================================================
-- 2026-09-03: lesson_topics — план тем для ИИ-завода контента
-- Часть фичи «ИИ-завод» (ступень 2 агентского API).
-- Автор ведёт план тем в кабинете (/dashboard/mentor/topics); агент берёт
-- следующую тему через /api/agent/topics, пишет урок и публикует через
-- /api/agent/lessons. Пустой title = «автор не задал тему — агент предложит сам».
-- Выполняет Анатолий в SQL Editor (MCP read-only).
-- ============================================================================

begin;

create table if not exists public.lesson_topics (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  -- Пустая тема — легальный случай: агент сам предложит тему и впишет сюда
  title text,
  notes text,
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'published', 'skipped')),
  -- Урок, созданный по теме (заполняет агент при публикации/создании черновика)
  lesson_id uuid references public.lessons(id) on delete set null,
  -- Кто внёс тему: автор из кабинета или агент (сам предложил)
  suggested_by text not null default 'author'
    check (suggested_by in ('author', 'agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_topics_coach_idx on public.lesson_topics (coach_id, created_at desc);

-- RLS: автор видит и меняет только темы СВОЕГО кабинета (coaches.user_id = auth.uid()).
-- Агентский API работает под сессией владельца ключа (lib/agentAuth.ts),
-- поэтому те же политики автоматически ограничивают и агента его автором.
alter table public.lesson_topics enable row level security;

drop policy if exists lesson_topics_select_own on public.lesson_topics;
create policy lesson_topics_select_own on public.lesson_topics
  for select using (
    coach_id in (select id from public.coaches where user_id = auth.uid())
  );

drop policy if exists lesson_topics_insert_own on public.lesson_topics;
create policy lesson_topics_insert_own on public.lesson_topics
  for insert with check (
    coach_id in (select id from public.coaches where user_id = auth.uid())
  );

drop policy if exists lesson_topics_update_own on public.lesson_topics;
create policy lesson_topics_update_own on public.lesson_topics
  for update using (
    coach_id in (select id from public.coaches where user_id = auth.uid())
  );

drop policy if exists lesson_topics_delete_own on public.lesson_topics;
create policy lesson_topics_delete_own on public.lesson_topics
  for delete using (
    coach_id in (select id from public.coaches where user_id = auth.uid())
  );

commit;

-- ============================================================================
-- Проверка после выполнения:
--   select policyname from pg_policies where tablename = 'lesson_topics';
-- Ожидание: 4 политики (select/insert/update/delete _own).
-- ============================================================================