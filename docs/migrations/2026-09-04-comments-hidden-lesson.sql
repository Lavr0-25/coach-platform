-- 2026-09-04 — Защита комментариев скрытых уроков
-- Проблема: RLS таблицы comments не проверял видимость урока — знающий lesson_id
-- мог прочитать комментарии урока, который ему недоступен (страница даёт 404,
-- а комментарии по REST API были открыты). Осознанная граница фичи «Скрытые
-- уроки» закрывается.
--
-- Решение: SECURITY DEFINER-функция lesson_visible_to() — «виден ли урок этому
-- пользователю» (для не-скрытых уроков — всегда да, для скрытых — автор или
-- допущенный). Политики SELECT/INSERT комментариев добавляют эту проверку.
-- UPDATE/DELETE не трогаем: там и так «только свой», утечки контента нет.
-- course_id (NULL lesson_id) — комментарии курса, проверка пропускает.
--
-- Файл дополнение к docs/migrations/2026-09-04-hidden-lessons.sql (там же
-- находятся функции is_coach_of_lesson() и политика lesson_access).

-- 1. Функция видимости урока
create or replace function public.lesson_visible_to(p_lesson_id uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select case
    when l.id is null then false            -- урока нет → не виден
    when not l.is_hidden then true          -- обычный урок — виден как раньше
    else coalesce(is_coach_of_lesson(p_lesson_id, p_user), false)   -- автор
         or exists (                                                 -- допущенный
           select 1 from lesson_access a
           where a.lesson_id = p_lesson_id
             and a.user_id = p_user
             and a.revoked = false
         )
  end
  from lessons l
  where l.id = p_lesson_id
$$;

-- Урока нет → запрос вернёт 0 строк → функция вернёт NULL → политика откажет.

-- 2. Пересоздание политик чтения/вставки комментариев
drop policy if exists comments_select_public_or_own on public.comments;
create policy comments_select_public_or_own on public.comments
  for select to public
  using (
    ((not is_private) or (auth.uid() = user_id))   -- прежнее правило
    and lesson_visible_to(lesson_id)                -- новое: видимость урока
  );

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert to public
  with check (
    auth.uid() = user_id
    and lesson_visible_to(lesson_id)                -- нельзя писать в недоступный урок
  );

-- Проверка после применения:
-- select lesson_visible_to('<uuid скрытого урока>'::uuid, null)  → false (аноним)
-- select lesson_visible_to('<uuid скрытого урока>'::uuid, '<uuid автора>')  → true