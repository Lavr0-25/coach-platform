-- 2026-09-16: гость читает бесплатный контент без регистрации (воронка из Дзена/TG)
--
-- Проблема (скрин Анатолия 16.09, урок df8bf54f): политика lesson_content_read
-- была to {authenticated} → аноним не получал строку lesson_content даже на
-- бесплатном опубликованном уроке; страница показывала «Контент урока
-- недоступен» + «Войдите, чтобы читать». Читатель из Дзена упирался в логин.
--
-- Фикс: пересоздать политику to {public}. Условие (qual) НЕ меняется:
-- ветки с auth.uid() для анонима ложны, остаётся только ветка
-- «price = 0 ИЛИ is_free_preview» (+ курсовая ветка для бесплатных курсов).
-- Платный контент анониму по-прежнему не отдаётся.
--
-- Проверка после применения (SQL Editor):
--   1) Гость (инкогнито) открывает бесплатный урок — текст виден.
--   2) Гость открывает платный урок (price > 0) — «Контент урока недоступен».
--   3) Залогиненный студент без покупки на платном уроке — по-прежнему нет.

drop policy if exists lesson_content_read on lesson_content;

create policy lesson_content_read on lesson_content
  for select
  to public
  using (
    exists (
      select 1 from lessons l
      join coaches c on c.id = l.coach_id
      where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
    )
    or exists (
      select 1 from coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
    or exists (
      select 1 from lessons l
      where l.id = lesson_content.lesson_id
        and (l.price = 0 or l.is_free_preview)
    )
    or exists (
      select 1 from lessons l
      where l.id = lesson_content.lesson_id
        and exists (
          select 1 from purchases p
          where p.user_id = auth.uid() and p.lesson_id = l.id
            and p.payment_status = 'completed'
        )
    )
    or exists (
      select 1 from lessons l
      where l.id = lesson_content.lesson_id and l.in_subscription
        and exists (
          select 1 from paid_subscriptions ps
          where ps.user_id = auth.uid()
            and ps.coach_user_id = (select c.user_id from coaches c where c.id = l.coach_id)
            and ps.status in ('active', 'cancelled') and ps.period_end >= now()
        )
    )
    or exists (
      select 1
      from lessons l
      join course_lessons cl on cl.lesson_id = l.id
      join courses co on co.id = cl.course_id
      where l.id = lesson_content.lesson_id and co.is_published
        and (l.price = 0 or l.is_free_preview or co.price = 0
          or exists (
            select 1 from purchases p
            where p.user_id = auth.uid() and p.payment_status = 'completed'
              and (p.lesson_id = l.id or p.course_id = co.id)
          ))
    )
  );