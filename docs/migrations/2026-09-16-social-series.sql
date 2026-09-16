-- №30 «Динамика охватов»: серии лайков/избранного по дням для детальной аналитики.
-- Проблема: RLS таблицы favorites не даёт автору читать чужие строки (даже на своих
-- уроках/курсах), поэтому график «Реакции по дням» на детальной странице всегда
-- показывал 0 в избранном. Суммы уже решены функцией get_lesson_social_counts
-- (SECURITY DEFINER); для серий по дням нужна своя функция.
-- Идемпотентно: CREATE OR REPLACE. Применять от имени владельца проекта (SQL Editor).

CREATE OR REPLACE FUNCTION public.get_social_series(
  p_lesson_id uuid DEFAULT NULL,
  p_course_id uuid DEFAULT NULL
)
RETURNS TABLE(kind text, day date, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT 'like'::text AS kind, k.created_at::date AS day, count(*)::bigint AS cnt
    FROM public.likes k
    JOIN public.lessons l ON l.id = k.lesson_id
    WHERE p_lesson_id IS NOT NULL
      AND k.lesson_id = p_lesson_id
      AND k.created_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.id = l.coach_id AND c.user_id = auth.uid()
      )
    GROUP BY 1, 2
  UNION ALL
  SELECT 'favorite'::text, f.created_at::date, count(*)::bigint
    FROM public.favorites f
    JOIN public.lessons l ON l.id = f.lesson_id
    WHERE p_lesson_id IS NOT NULL
      AND f.lesson_id = p_lesson_id
      AND f.created_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.id = l.coach_id AND c.user_id = auth.uid()
      )
    GROUP BY 1, 2
  UNION ALL
  SELECT 'favorite'::text, f.created_at::date, count(*)::bigint
    FROM public.favorites f
    JOIN public.courses cs ON cs.id = f.course_id
    WHERE p_course_id IS NOT NULL
      AND f.course_id = p_course_id
      AND f.created_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.id = cs.coach_id AND c.user_id = auth.uid()
      )
    GROUP BY 1, 2
$function$;

-- Функция проверяет владельца материала (coaches.user_id = auth.uid()) внутри себя,
-- поэтому открытый GRANT на EXECUTE безопасен (по умолчанию EXECUTE у функций уже
-- выдан public — оставляем как есть).