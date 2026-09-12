-- Ф3, фикс волны 2 (найден на самопроверке 12.09): контент урока не отдавался
-- платному подписчику. Страница урока открывала доступ по getPaidSubscription
-- (active/cancelled с period_end >= now(), материал с флагом in_subscription),
-- но RLS-политика lesson_content_read (из 2026-09-03-rls-audit.sql) знает только
-- про покупки purchases — подписчик видел «Контент урока недоступен».
-- Фикс: пересоздаём SELECT-политику, добавляя ветку платной подписки на автора.
-- Идемпотентно: drop policy if exists перед create.

drop policy if exists lesson_content_read on public.lesson_content;

create policy lesson_content_read on public.lesson_content
for select to authenticated
using (
  -- автор урока
  exists (
    select 1 from lessons l join coaches c on c.id = l.coach_id
    where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
  )
  -- админ
  or exists (
    select 1 from coaches c
    where c.user_id = auth.uid() and c.role = 'admin'
  )
  -- бесплатный урок
  or exists (
    select 1 from lessons l
    where l.id = lesson_content.lesson_id
      and (l.price = 0 or l.is_free_preview)
  )
  -- купленный урок (разовая покупка)
  or exists (
    select 1 from lessons l
    where l.id = lesson_content.lesson_id
      and exists (
        select 1 from purchases p
        where p.user_id = auth.uid() and p.lesson_id = l.id
          and p.payment_status = 'completed'
      )
  )
  -- Ф3: платная подписка на автора (active или отменённая до конца периода),
  -- урок с флагом in_subscription
  or exists (
    select 1 from lessons l
    where l.id = lesson_content.lesson_id
      and l.in_subscription
      and exists (
        select 1 from paid_subscriptions ps
        where ps.user_id = auth.uid()
          and ps.coach_user_id = (
            select c.user_id from coaches c where c.id = l.coach_id
          )
          and ps.status in ('active', 'cancelled')
          and ps.period_end >= now()
      )
  )
  -- урок внутри курса: бесплатный или купленный курс/урок
  or exists (
    select 1
    from lessons l
    join course_lessons cl on cl.lesson_id = l.id
    join courses co on co.id = cl.course_id
    where l.id = lesson_content.lesson_id
      and co.is_published
      and (
        l.price = 0 or l.is_free_preview or co.price = 0
        or exists (
          select 1 from purchases p
          where p.user_id = auth.uid() and p.payment_status = 'completed'
            and (p.lesson_id = l.id or p.course_id = co.id)
        )
      )
  )
);

-- Проверка: SELECT policyname, cmd FROM pg_policies WHERE tablename = 'lesson_content';