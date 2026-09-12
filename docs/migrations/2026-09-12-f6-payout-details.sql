-- ============================================================================
-- Миграция 2026-09-12: Ф6.2 — реквизиты для выплат автора
-- Статус: к выполнению в Supabase SQL Editor (вставить файл целиком, Run)
--
-- Зачем: роялти копится с момента продажи; реквизиты автор указывает в
-- кабинете (раздел «Партнёрство») к первой выплате. Не указал — не сгорает
-- (п. 6.2 оферты), выплата после заполнения.
--
-- Структура: отдельные поля, а не один текст — админу проще сверять реквизиты
-- по частям; на стороне приложения и в БД валидация (карта 16–19 цифр или
-- счёт 20, БИК 9 цифр).
--
-- Почему отдельная таблица, а не колонка в coaches: у coaches SELECT
-- публичный («Public read access for coaches») — банковские реквизиты там
-- читал бы кто угодно. Здесь чтение — только владелец и админ.
--
-- Выплаты на старте делает вручную бухгалтер; автоматизация уточнит структуру.
--
-- Откат: drop table public.mentor_payout_details;
-- ============================================================================

begin;

-- Если ранняя версия миграции (одна text-колонка) уже применена — заменяем:
drop table if exists public.mentor_payout_details cascade;

create table public.mentor_payout_details (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null unique,
  holder_name text not null check (char_length(btrim(holder_name)) between 3 and 150),
  account_no text not null check (btrim(account_no) ~ '^[0-9]{16,20}$'),
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 100),
  bik text check (bik is null or bik ~ '^[0-9]{9}$'),
  updated_at timestamptz not null default now(),
  -- БИК обязателен для счёта (20 цифр): платёж без него не провести.
  -- Для карты (16–19 цифр) БИК не требуется.
  constraint mentor_payout_bik_required
    check (btrim(account_no) ~ '^[0-9]{16,19}$' or bik ~ '^[0-9]{9}$')
);

alter table public.mentor_payout_details enable row level security;

-- Чтение: владелец или админ (админ делает выплаты)
create policy mentor_payout_details_select on public.mentor_payout_details
  for select to authenticated
  using (
    coach_user_id = auth.uid()
    or exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

-- Запись: только свой (upsert = insert + update, нужны обе политики)
create policy mentor_payout_details_insert_own on public.mentor_payout_details
  for insert to authenticated
  with check (coach_user_id = auth.uid());

create policy mentor_payout_details_update_own on public.mentor_payout_details
  for update to authenticated
  using (coach_user_id = auth.uid())
  with check (coach_user_id = auth.uid());

-- Удаление клиенту не даём; админ правит через SQL Editor при необходимости.

commit;

-- ============================================================================
-- Проверки (выполнить по одному, каждый должен вернуть 1):
--   select count(*) from pg_policies where tablename = 'mentor_payout_details';  -- 3
--   select relrowsecurity from pg_class where relname = 'mentor_payout_details'; -- true
-- ============================================================================