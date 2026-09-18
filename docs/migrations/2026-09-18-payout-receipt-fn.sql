-- Миграция 2026-09-18: чек «Мой налог» прикладывает автор.
-- Развитие кошелька (2026-09-17): админ может отметить «Выплачено» без чека,
-- автор затем прикладывает номер сам в кабинете; пока чека нет — новые
-- заявки на вывод заблокированы (requestPayout проверяет unreceiptedPayout).
--
-- UPDATE-политику ментору не даём (иначе он мог бы менять amount/status/
-- processed_at своей заявки). Вместо неё — SECURITY DEFINER-функция: она
-- проверяет владельца, статус и «чека ещё нет» внутри и обновляет ровно
-- одно поле receipt_number. Клиент вызывает supabase.rpc().
--
-- Пустая строка считается «чека нет» (наследие старого шага «Выплачено»,
-- когда админ мог сохранить '').

CREATE OR REPLACE FUNCTION public.attach_payout_receipt(
  p_request_id uuid,
  p_receipt text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Требуется вход';
  END IF;
  IF p_receipt IS NULL OR length(trim(p_receipt)) < 3 OR length(trim(p_receipt)) > 50 THEN
    RAISE EXCEPTION 'Номер чека — от 3 до 50 символов';
  END IF;

  UPDATE public.payout_requests
    SET receipt_number = trim(p_receipt)
    WHERE id = p_request_id
      AND coach_user_id = v_user
      AND status = 'paid'
      AND (receipt_number IS NULL OR receipt_number = '');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Заявка не найдена или чек уже приложен';
  END IF;
END;
$$;

-- Функция только для залогиненных: anon вызывать не должен.
REVOKE EXECUTE ON FUNCTION public.attach_payout_receipt(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_payout_receipt(uuid, text) TO authenticated;

-- Верификация (после применения):
--   1) select prosecdef from pg_proc where proname = 'attach_payout_receipt'; -- true
--   2) под токеном ментора: select attach_payout_receipt('<чужой uuid>','123')
--      → ошибка «Заявка не найдена»; под своим paid-заявкой без чека → успех.