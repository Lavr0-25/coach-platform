-- 2026-09-16. Мат-фильтр триггера: поиск подстроки → сравнение целых слов.
--
-- Проблема: reject_banned_words() (миграция 2026-09-12) искала запрещённое
-- слово ПОДСТРОКОЙ (position(word in text)). В списке banned_words есть
-- короткие слова «бля», «манда», «конча», «гнид» — они сидят внутри честных
-- слов: «рубля», «команда», «кончается». Комментарий «команда ментора» и
-- отзыв «за 500 рублей» отклонялись триггером. Клиентский хелпер
-- lib/banned-words.ts содержал ту же ошибку (исправлен кодом в том же наборе).
-- Серверная версия для агентского API (lib/bannedWords.ts) уже была
-- исправлена 08.09 на целые слова — теперь и триггер.
--
-- Идемпотентно: CREATE OR REPLACE той же функции, имя/сигнатура/сообщение
-- об ошибке не меняются — триггеры comments_banned_words,
-- reviews_banned_words, feedback_banned_words продолжают работать.
-- Применение: SQL Editor (пользователь).

CREATE OR REPLACE FUNCTION public.reject_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  rec jsonb := to_jsonb(new);
  v_text text;
  v_bad text;
begin
  -- Собираем все текстовые поля вставки, какие есть в таблице
  -- (comments.content, feedback.title/description/user_name, reviews.comment)
  v_text := coalesce(rec->>'content', '')
         || ' ' || coalesce(rec->>'title', '')
         || ' ' || coalesce(rec->>'description', '')
         || ' ' || coalesce(rec->>'comment', '')
         || ' ' || coalesce(rec->>'user_name', '');

  if v_text = '' then
    return new;
  end if;

  -- Сравнение ЦЕЛЫХ слов: текст режется на токены по не-буквам/цифрам,
  -- запрещённое слово должно совпасть с токеном целиком. Подстрока ловила
  -- честные слова («конча» в «кончать», «манда» в «команда», «бля» в
  -- «рубля») — та же логика, что в lib/bannedWords.ts (08.09).
  select w.word into v_bad
  from banned_words w
  where coalesce(w.word, '') <> ''
    and lower(w.word) = any (
      regexp_split_to_array(lower(v_text), '[^a-zа-яё0-9]+')
    )
  limit 1;

  if v_bad is not null then
    raise exception 'Текст содержит недопустимое слово: %', v_bad;
  end if;

  return new;
end;
$function$;

-- Контроль после применения (ожидаем: слово «бля» НЕ матчит «рубля», но матчит токен «бля»):
-- select public.reject_banned_words_test();
-- или напрямую: INSERT comment с текстом «команда» должен пройти,
-- с текстом «бля» — упасть с ошибкой «Текст содержит недопустимое слово».