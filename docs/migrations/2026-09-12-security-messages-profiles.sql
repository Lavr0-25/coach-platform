-- Пентест 12.09 (tmp/pentest-report-2026-09-12.md): фиксы RLS.
-- 1. КРИТИЧНО: любой залогиненный пользователь читал ВСЮ переписку в messages.
--    Причина: пермиссивная политика «blocked» почти всегда TRUE и OR-ится
--    с messages_select_own (политики складываются через ИЛИ). Фикс: обе
--    политики-ограничения переводим в AS RESTRICTIVE — тогда они пересекаются
--    с базовыми (И), а не добавляются (ИЛИ). Заодно закрывает подмену
--    sender_id в INSERT.
-- 2. СРЕДНЕ: аноним читал email всех пользователей через /rest/v1/profiles.
--    Фикс: колонка email отбирается у роли anon (приложение email из
--    profiles не использует; админка работает под залогином).
-- 3. СРЕДНЕ: мат-фильтр жил только на клиенте — через REST мат проходил.
--    Фикс: BEFORE-триггер на comments/feedback/reviews проверяет
--    banned_words на сервере (security definer, чтобы читать список без
--    зависимости от RLS). Подмена sender_id в messages закрыта в п.1.
-- Идемпотентно: drop policy/function/trigger if exists перед create.

-- ============ 1. Messages: утечка переписки и подмена отправителя ============

drop policy if exists "Users cannot see messages from blocked users" on public.messages;
create policy "Users cannot see messages from blocked users"
  on public.messages as restrictive
  for select to authenticated
  using (
    not exists (
      select 1 from blocked_users bu
      where bu.blocker_id = auth.uid() and bu.blocked_id = messages.sender_id
    )
  );

drop policy if exists "Blocked users cannot send messages" on public.messages;
create policy "Blocked users cannot send messages"
  on public.messages as restrictive
  for insert to authenticated
  with check (
    not exists (
      select 1 from blocked_users bu
      where bu.blocker_id = messages.receiver_id and bu.blocked_id = auth.uid()
    )
  );

-- messages_select_own (только свои sender/receiver) остаётся базовой
-- пермиссивной политикой — RESTRICTIVE пересекается с ней (И).

-- ============ 2. Profiles: email не отдаётся анониму ============
-- Важно: отзыв на уровне колонки НЕ перекрывает табличный SELECT, поэтому
-- снимаем табличный доступ и выдаём явно все колонки, кроме email.

revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url, is_approved, created_at, updated_at, role, is_public)
  on public.profiles to anon;

-- ============ 3. Мат-фильтр на сервере (триггер) ============

create or replace function public.reject_banned_words() returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  select w.word into v_bad
  from banned_words w
  where position(lower(w.word) in lower(v_text)) > 0
  limit 1;

  if v_bad is not null then
    raise exception 'Текст содержит недопустимое слово: %', v_bad;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_banned_words on public.comments;
create trigger comments_banned_words
  before insert or update on public.comments
  for each row execute function public.reject_banned_words();

drop trigger if exists feedback_banned_words on public.feedback;
create trigger feedback_banned_words
  before insert or update on public.feedback
  for each row execute function public.reject_banned_words();

drop trigger if exists reviews_banned_words on public.reviews;
create trigger reviews_banned_words
  before insert or update on public.reviews
  for each row execute function public.reject_banned_words();

-- Проверки после запуска:
-- 1) select tablename, policyname, permissive from pg_policies
--    where tablename = 'messages';        -- обе «blocked» = RESTRICTIVE
-- 2) под анонимом: select email from profiles limit 1;  -- permission denied
-- 3) insert в comments с матом под юзером;              -- error