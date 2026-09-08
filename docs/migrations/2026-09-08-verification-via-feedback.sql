-- 2026-09-08 — Верификация авторов через обратную связь
-- Решение (Анатолий): заявку подаёт сам автор сообщением в «Обратную связь»
-- (новый тип `verification`), админ принимает (is_verified=true) или отклоняет
-- с пояснением через существующий цикл обращений. Галочку «Проверен» больше не
-- ставим вручную по своей инициативе: до заявки все авторы считаются
-- непроверенными, кроме двоих, подтверждённых лично.

-- 1. Новый тип обращения «Заявка на верификацию»
ALTER TABLE public.feedback DROP CONSTRAINT feedback_type_check;
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_type_check
  CHECK (type IN ('bug', 'feature', 'verification'));

-- 2. Чистка старой ручной проверки: только Георгий Кодов и Дарина Богун остаются
-- проверенными (решение Анатолия 2026-09-08)
UPDATE public.coaches
SET is_verified = false
WHERE role = 'mentor'
  AND display_name NOT IN ('Георгий Кодов', 'Дарина Богун');

-- Журнал: ALTER + UPDATE, откат — обратный CHECK без 'verification'.