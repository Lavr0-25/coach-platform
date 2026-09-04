-- Скрытые уроки (2026-09-04): режим видимости «по ссылке + приглашения» / «только по приглашению».
-- Скрытый урок: is_published=true + is_hidden=true; не в каталоге/поиске/sitemap (фильтр в коде),
-- на уровне БД читается только автором и допущенными (lesson_access, revoked=false).

-- 1. Флаги урока
alter table public.lessons
  add column if not exists is_hidden boolean not null default false,
  add column if not exists link_access boolean not null default true;

comment on column public.lessons.is_hidden is 'Скрытый урок: виден только автору и допущенным (lesson_access), не в каталоге/поиске';
comment on column public.lessons.link_access is 'Скрытый урок: приём по ссылке (true — перешедший попадает в lesson_access автоматически, false — только личный допуск)';

-- 2. Таблица доступов
create table if not exists public.lesson_access (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('manual', 'link')),
  added_by uuid references auth.users(id),
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

comment on table public.lesson_access is 'Допуск пользователей к скрытым урокам; отзыв = revoked=true (не удаление, чтобы ссылка не вернула доступ)';
comment on column public.lesson_access.source is 'manual — добавлен автором; link — пришёл по ссылке (самоприглашение)';
comment on column public.lesson_access.revoked is 'true — доступ отозван автором; строка остаётся, чтобы ссылка не добавила повторно';

create index if not exists lesson_access_lesson_idx on public.lesson_access(lesson_id);
create index if not exists lesson_access_user_idx on public.lesson_access(user_id);

-- 3. RLS
alter table public.lesson_access enable row level security;

-- ВАЖНО (миграция hidden_lessons_recursion_fix, применена следом): политики ниже в исходной
-- версии ссылались на lessons напрямую → «infinite recursion detected in policy» → ВСЕ запросы
-- уроков падали с 500. Рабочий вариант (актуален в БД): проверки через SECURITY DEFINER
-- функции is_coach_of_lesson() и lesson_accepts_link() — см. раздел 5 в конце файла.

-- Автор урока видит все строки доступов своего урока
create policy lesson_access_owner_select on public.lesson_access
  for select using (
    exists (
      select 1 from public.lessons l
      join public.coaches c on c.id = l.coach_id
      where l.id = lesson_access.lesson_id and c.user_id = auth.uid()
    )
  );

-- Пользователь видит свои строки (нужно для проверки доступа на странице урока)
create policy lesson_access_user_select on public.lesson_access
  for select using (user_id = auth.uid());

-- Автор добавляет вручную
create policy lesson_access_owner_insert on public.lesson_access
  for insert with check (
    source = 'manual'
    and exists (
      select 1 from public.lessons l
      join public.coaches c on c.id = l.coach_id
      where l.id = lesson_access.lesson_id and c.user_id = auth.uid()
    )
  );

-- Самоприглашение по ссылке: только скрытый урок с приёмом по ссылке
create policy lesson_access_self_insert on public.lesson_access
  for insert with check (
    source = 'link'
    and user_id = auth.uid()
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_access.lesson_id
        and l.is_hidden = true
        and l.link_access = true
    )
  );

-- Отзыв (revoked=true) и удаление строки — только автор урока
create policy lesson_access_owner_update on public.lesson_access
  for update using (
    exists (
      select 1 from public.lessons l
      join public.coaches c on c.id = l.coach_id
      where l.id = lesson_access.lesson_id and c.user_id = auth.uid()
    )
  );

create policy lesson_access_owner_delete on public.lesson_access
  for delete using (
    exists (
      select 1 from public.lessons l
      join public.coaches c on c.id = l.coach_id
      where l.id = lesson_access.lesson_id and c.user_id = auth.uid()
    )
  );

-- 4. Чтение lessons: скрытый урок не «публичный» — только автору (lessons_owner_select)
-- или допущенным (активная строка lesson_access). Правило курсов не трогаем:
-- скрытый урок в курсе не живёт (отвязка при включении режима, серверный экшен).
drop policy if exists lessons_public_read on public.lessons;
create policy lessons_public_read on public.lessons
  for select using (
    (
      is_published = true
      and is_hidden = false
    )
    or (
      exists (
        select 1
        from public.course_lessons cl
        join public.courses c on c.id = cl.course_id
        where cl.lesson_id = lessons.id and c.is_published = true
      )
    )
    or (
      is_hidden = true
      and exists (
        select 1 from public.lesson_access la
        where la.lesson_id = lessons.id
          and la.user_id = auth.uid()
          and la.revoked = false
      )
    )
  );
-- ============================================================================
-- 5. Миграция hidden_lessons_recursion_fix (2026-09-04, применена на прод)
-- ============================================================================
-- Проблема: политики lesson_access из раздела 3 в исходной версии проверяли автора
-- через подзапрос к lessons → Postgres увидел цикл lesson_access → lessons →
-- lesson_access и ответил «infinite recursion detected in policy» на ЛЮБОЙ запрос
-- уроков (500 на всех страницах уроков).
-- Решение: проверки авторства и режима урока вынесены в SECURITY DEFINER-функции —
-- они выполняются с правами владельца и не запускают RLS-проверку lessons по кругу.

-- SECURITY DEFINER: автор урока (coaches.user_id = указанный пользователь)
create or replace function public.is_coach_of_lesson(p_lesson_id uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.lessons l
    join public.coaches c on c.id = l.coach_id
    where l.id = p_lesson_id and c.user_id = p_user
  )
$$;

-- SECURITY DEFINER: урок скрытый и принимает по ссылке
create or replace function public.lesson_accepts_link(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.lessons l
    where l.id = p_lesson_id and l.is_hidden = true and l.link_access = true
  )
$$;

-- Пересоздаём политики lesson_access на функциях (сносим старые, где был подзапрос к lessons)
drop policy if exists lesson_access_owner_select on public.lesson_access;
create policy lesson_access_owner_select on public.lesson_access
  for select using (is_coach_of_lesson(lesson_id));

-- Пользователь видит свои строки (нужно для проверки доступа на странице урока)
create policy lesson_access_user_select on public.lesson_access
  for select using (user_id = auth.uid());

drop policy if exists lesson_access_owner_insert on public.lesson_access;
create policy lesson_access_owner_insert on public.lesson_access
  for insert with check (
    source = 'manual'
    and is_coach_of_lesson(lesson_id)
  );

-- Самоприглашение по ссылке: только скрытый урок с приёмом по ссылке.
-- lesson_accepts_link() — SECURITY DEFINER, поэтому проверка срабатывает даже когда
-- пользователь ещё НЕ видит сам урок (до вставки строки в lesson_access).
drop policy if exists lesson_access_self_insert on public.lesson_access;
create policy lesson_access_self_insert on public.lesson_access
  for insert with check (
    source = 'link'
    and user_id = auth.uid()
    and lesson_accepts_link(lesson_id)
  );

drop policy if exists lesson_access_owner_update on public.lesson_access;
create policy lesson_access_owner_update on public.lesson_access
  for update using (is_coach_of_lesson(lesson_id));

drop policy if exists lesson_access_owner_delete on public.lesson_access;
create policy lesson_access_owner_delete on public.lesson_access
  for delete using (is_coach_of_lesson(lesson_id));
