-- №17 Лайки уроков: защита от дублей + счётчики для кабинета автора
-- Дата: 2026-09-05

-- 1) Один пользователь — один лайк на урок (двойной клик / гонка не создадут дубликаты).
--    Частичный индекс: строки с user_id IS NULL (анонимные, дизайн-задел) не участвуют.
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_lesson_uniq
  ON public.likes (user_id, lesson_id)
  WHERE user_id IS NOT NULL;

-- 2) Счётчики лайков и избранного по урокам автора.
--    Нужна, потому что RLS favorites разрешает SELECT только своих строк
--    (enable_select_for_users), а автору нужны чужие отметки «в избранное»
--    на СВОИХ уроках. SECURITY DEFINER обходит RLS, но фильтр по владельцу
--    (coaches.user_id = auth.uid()) не даёт подсмотреть чужие уроки.
CREATE OR REPLACE FUNCTION public.get_lesson_social_counts(p_lesson_ids uuid[])
RETURNS TABLE (lesson_id uuid, likes bigint, favorites bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    l.id AS lesson_id,
    (SELECT count(*) FROM public.likes k
      WHERE k.lesson_id = l.id AND k.user_id IS NOT NULL) AS likes,
    (SELECT count(*) FROM public.favorites f
      WHERE f.lesson_id = l.id) AS favorites
  FROM public.lessons l
  WHERE l.id = ANY (p_lesson_ids)
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = l.coach_id AND c.user_id = auth.uid()
    );
$$;

-- Функция только для залогиненных авторов
REVOKE EXECUTE ON FUNCTION public.get_lesson_social_counts(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_lesson_social_counts(uuid[]) TO authenticated;