-- Миграция: новый тип обращения «Вопрос» (question) в feedback.
-- Контекст: в форме /feedback было 3 типа (bug/feature/verification) —
-- «просто вопрос» помещать было некуда. Ссылка из Справочника /help
-- «Не нашли ответ?» ведёт на /feedback?type=question.
-- Применить: Supabase Dashboard → SQL Editor (2026-09-09).
-- Обратимость: предыдущий констрейнт восстанавливается запросом из шапки.

-- 1. Удаляем старый CHECK-констрейнт
ALTER TABLE public.feedback
  DROP CONSTRAINT feedback_type_check;

-- 2. Создаём новый с типом question
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_type_check
  CHECK (type = ANY (ARRAY['bug'::text, 'feature'::text, 'verification'::text, 'question'::text]));

-- Откат (если понадобится):
-- ALTER TABLE public.feedback DROP CONSTRAINT feedback_type_check;
-- ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check
--   CHECK (type = ANY (ARRAY['bug'::text, 'feature'::text, 'verification'::text]));