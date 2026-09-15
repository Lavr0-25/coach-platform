-- 2026-09-15. Ф7 «Статистика продаж»: ментор видит покупки своих материалов,
-- админ видит все покупки. Покупатель по-прежнему видит только свои покупки.
--
-- Почему: до сих пор политика была одна — «Users can view own purchases»
-- (auth.uid() = user_id), поэтому ни ментор, ни админ не могли построить
-- статистику продаж (страница «Аналитика», /admin/purchases).
--
-- Рекурсии RLS нет: политика purchases ссылается на lessons/courses/coaches,
-- но ни одна из них не ссылается на purchases.
--
-- Применить в SQL Editor (Supabase Dashboard). Повторный запуск безопасен.

-- 1. Ментор видит покупки своих уроков и своих курсов
drop policy if exists "Mentors can view purchases of own materials" on public.purchases;
create policy "Mentors can view purchases of own materials"
  on public.purchases
  for select
  using (
    exists (
      select 1 from public.lessons l
      where l.id = purchases.lesson_id
        and l.coach_id in (select c.id from public.coaches c where c.user_id = auth.uid())
    )
    or exists (
      select 1 from public.courses cr
      where cr.id = purchases.course_id
        and cr.coach_id in (select c.id from public.coaches c where c.user_id = auth.uid())
    )
  );

-- 2. Админ видит все покупки (чтение; запись остаётся у вебхука через сервисный ключ)
drop policy if exists "Admins can view all purchases" on public.purchases;
create policy "Admins can view all purchases"
  on public.purchases
  for select
  using (
    exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

-- 3. Контроль: перечислить политики purchases
select policyname, cmd, qual from pg_policies where tablename = 'purchases';