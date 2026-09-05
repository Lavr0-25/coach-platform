-- Миграция 2026-09-05: уведомления о новых личных сообщениях (AC8 варианта B, задача №18)
-- Триггер AFTER INSERT ON messages создаёт уведомление получателю,
-- если он не заблокировал отправителя. SECURITY DEFINER нужен, потому что
-- у таблицы notifications нет INSERT-политики (записи создаёт только система).

-- 1. Разрешаем type='new_message' в check-констрейнте
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
CHECK ((type = ANY (ARRAY['new_comment'::text, 'new_reply'::text, 'mentor_reply'::text, 'new_message'::text, 'ban'::text, 'comment_deleted'::text, 'review_deleted'::text, 'achievement'::text])));

-- 2. Триггер-функция
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Получатель заблокировал отправителя → уведомление не создаём
  if exists (
    select 1 from blocked_users
    where blocker_id = new.receiver_id and blocked_id = new.sender_id
  ) then
    return new;
  end if;

  insert into notifications (user_id, type, title, message, link, is_read)
  values (
    new.receiver_id,
    'new_message',
    'Новое личное сообщение',
    left(new.content, 80),
    '/messages/' || new.sender_id::text,
    false
  );

  return new;
end;
$$;

drop trigger if exists on_message_notify on public.messages;
create trigger on_message_notify
after insert on public.messages
for each row execute function public.notify_new_message();