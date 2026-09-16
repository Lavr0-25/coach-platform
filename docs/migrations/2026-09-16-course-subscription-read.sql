-- 2026-09-16. Фикс RLS: подписка на автора открывает платные уроки его курса.
--
-- Проблема (security-прогон 16.09): политика lesson_content_read имела
-- подписочную ветку только для отдельных уроков (по флагу lessons.in_subscription),
-- а в ветке курсов её не было. При этом UI (app/course/[id]/page.tsx) открывает
-- подписчику курс с courses.in_subscription = true («Начать обучение»).
-- Итог: подписчик видел страницу курса, но контент платных уроков курса
-- БД ему не отдавала — фича «подписка открывает курс целиком» не работала.
--
-- Правка: в ветку курсов добавлена альтернатива «курс с in_subscription
-- доступен действующему подписчику автора курса».
--
-- Идемпотентно: drop policy if exists + create. Политика пересоздаётся
-- целиком из текущего продового текста (сверено с pg_policies 16.09)
-- плюс новая подписочная ветка курса.
-- Применение: SQL Editor (пользователь). После применения — контрольный
-- запрос в конце файла.

DROP POLICY IF EXISTS lesson_content_read ON public.lesson_content;

CREATE POLICY lesson_content_read ON public.lesson_content
  FOR SELECT
  USING (
    -- автор контента
    EXISTS (
      SELECT 1
      FROM lessons l
      JOIN coaches c ON c.id = l.coach_id
      WHERE l.id = lesson_content.lesson_id
        AND c.user_id = auth.uid()
    )
    -- админ
    OR EXISTS (
      SELECT 1
      FROM coaches c
      WHERE c.user_id = auth.uid()
        AND c.role = 'admin'
    )
    -- бесплатный урок или бесплатный фрагмент
    OR EXISTS (
      SELECT 1
      FROM lessons l
      WHERE l.id = lesson_content.lesson_id
        AND (l.price = 0 OR l.is_free_preview)
    )
    -- купил этот урок
    OR EXISTS (
      SELECT 1
      FROM lessons l
      WHERE l.id = lesson_content.lesson_id
        AND EXISTS (
          SELECT 1
          FROM purchases p
          WHERE p.user_id = auth.uid()
            AND p.lesson_id = l.id
            AND p.payment_status = 'completed'
        )
    )
    -- подписка на автора (отдельный урок с флагом)
    OR EXISTS (
      SELECT 1
      FROM lessons l
      WHERE l.id = lesson_content.lesson_id
        AND l.in_subscription
        AND EXISTS (
          SELECT 1
          FROM paid_subscriptions ps
          WHERE ps.user_id = auth.uid()
            AND ps.coach_user_id = (
              SELECT c.user_id
              FROM coaches c
              WHERE c.id = l.coach_id
            )
            AND ps.status IN ('active', 'cancelled')
            AND ps.period_end >= now()
        )
    )
    -- урок внутри курса
    OR EXISTS (
      SELECT 1
      FROM lessons l
      JOIN course_lessons cl ON cl.lesson_id = l.id
      JOIN courses co ON co.id = cl.course_id
      WHERE l.id = lesson_content.lesson_id
        AND co.is_published
        AND (
          l.price = 0
          OR l.is_free_preview
          OR co.price = 0
          -- купил урок или курс
          OR EXISTS (
            SELECT 1
            FROM purchases p
            WHERE p.user_id = auth.uid()
              AND p.payment_status = 'completed'
              AND (p.lesson_id = l.id OR p.course_id = co.id)
          )
          -- НОВОЕ: подписка на автора открывает курс целиком,
          -- если у курса стоит флаг in_subscription
          OR (
            co.in_subscription
            AND EXISTS (
              SELECT 1
              FROM paid_subscriptions ps
              WHERE ps.user_id = auth.uid()
                AND ps.coach_user_id = (
                  SELECT c.user_id
                  FROM coaches c
                  WHERE c.id = co.coach_id
                )
                AND ps.status IN ('active', 'cancelled')
                AND ps.period_end >= now()
            )
          )
        )
    )
  );

-- Контроль после применения (ожидаем: lesson_content_read со «subscription» в тексте,
-- командой SELECT):
-- select cmd, qual from pg_policies where tablename='lesson_content' and policyname='lesson_content_read';