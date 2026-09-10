-- ============================================================================
-- Ф1, фикс триггера рубильника (2026-09-10, после проверки живьём)
-- Проблема: триггер coaches_paid_publishing_guard проверяет админа через
-- auth.uid(). Серверный код (админ-клиент на сервисном ключе, как в Ф3/Ф2)
-- работает БЕЗ пользовательской сессии: auth.uid() = NULL → админ-действие
-- получит отказ. Проверено: PATCH под сервисным ключом вернул
-- P0001 "Изменение paid_publishing_allowed доступно только администратору".
-- Фикс: доверяем сервисному ключу (auth.uid() IS NULL — это только серверный
-- код с секретом), ментор-клиент по-прежнему заблокирован.
-- Идемпотентен: CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_paid_publishing_admin_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.paid_publishing_allowed IS DISTINCT FROM OLD.paid_publishing_allowed)
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM coaches c
       WHERE c.user_id = auth.uid() AND c.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Изменение paid_publishing_allowed доступно только администратору';
  END IF;
  RETURN NEW;
END;
$$;

-- Проверка (запустить отдельно):
-- SELECT prosrc FROM pg_proc WHERE proname = 'enforce_paid_publishing_admin_only';
-- Ожидаем: в тексте функции есть строка "auth.uid() IS NOT NULL".