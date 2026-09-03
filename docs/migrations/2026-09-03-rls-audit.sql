-- ============================================================================
-- Миграция 2026-09-03: RLS-аудит — эскалация прав, утечки, дубли политик
-- Статус: к выполнению в Supabase SQL Editor (вставить файл целиком, Run)
--
-- Чинит (по аудиту 2026-09-03):
--   КРИТИЧНО: user мог назначить себе роль admin (coaches, profiles);
--             контент платных уроков читался всеми; самопокупка в purchases.
--   СРЕДНЕ:   все жалобы видны всем; прогресс виден всем; лайки/стоп-лист
--             можно писать «от чужого имени».
--   ГИГИЕНА:  дубли политик (reviews, lesson_progress, messages, coaches,
--             courses, stop_list, profiles).
-- Попутно чинит: кнопка «Проверен» в админке (админ не мог менять чужие
--             строки coaches — политики UPDATE это не разрешали).
--
-- Откат: имена удалённых политик перечислены в комментариях; для отката
-- создайте их заново (см. docs/migrations/2026-09-02-rls-hardening.sql).
-- ============================================================================

begin;

-- ============================================================================
-- 1. COACHES — эскалация до admin (КРИТИЧНО)
-- ============================================================================

-- INSERT: только своя строка и только с ролью 'mentor'.
-- (раньше: «Users can insert own coaches» + coaches_insert_own без ограничения role)
drop policy if exists "Users can insert own coaches" on public.coaches;
drop policy if exists coaches_insert_own on public.coaches;
create policy coaches_insert_own on public.coaches
  for insert to authenticated
  with check (auth.uid() = user_id and coalesce(role, 'mentor') = 'mentor');

-- UPDATE: владелец (остаётся) + АДМИН может менять чужие строки
-- (раньше админского UPDATE не было — кнопка «Проверен» в админке падала)
drop policy if exists "Coaches can update own profile" on public.coaches;
drop policy if exists "Users can update own coaches" on public.coaches;
drop policy if exists coaches_update_own on public.coaches;
create policy coaches_update_own on public.coaches
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy coaches_admin_update on public.coaches
  for update to authenticated
  using (exists (select 1 from public.coaches c
                 where c.user_id = auth.uid() and c.role = 'admin'))
  with check (exists (select 1 from public.coaches c
                 where c.user_id = auth.uid() and c.role = 'admin'));

-- Триггер: не-админ не может менять служебные колонки (роль, верификация,
-- комиссия, доход). RLS не умеет ограничивать колонки — это стандартный способ.
-- service_role (сервисный ключ API) и SQL Editor проходят свободно.
create or replace function public.coaches_guard_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- без JWT (SQL Editor, service_role) — не ограничиваем
  if auth.uid() is null then
    return new;
  end if;
  -- админ может всё
  if exists (select 1 from coaches c
             where c.user_id = auth.uid() and c.role = 'admin') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.is_verified is distinct from old.is_verified
     or new.commission_rate is distinct from old.commission_rate
     or new.total_earnings is distinct from old.total_earnings then
    raise exception 'Служебные поля (роль, верификация, комиссия, доход) меняет только администратор';
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_guard_sensitive on public.coaches;
create trigger coaches_guard_sensitive
  before update on public.coaches
  for each row execute function public.coaches_guard_sensitive();

-- SELECT: дубли → остаётся одна публичная ("Public read access for coaches")
drop policy if exists "Allow public read access on coaches" on public.coaches;
drop policy if exists "Anyone can view approved coaches" on public.coaches;
drop policy if exists "Users can read own coaches" on public.coaches;
drop policy if exists coaches_select_all on public.coaches;

-- ============================================================================
-- 2. PROFILES — защита role и is_approved (КРИТИЧНО)
-- ============================================================================

-- SELECT: дубли → остаётся "Profiles are viewable by everyone"
drop policy if exists "Public read access for profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

-- UPDATE: владелец (остаётся) + триггер: role/is_approved меняет только админ
-- (гейт админа единый — coaches.role, как во всём приложении)
create or replace function public.profiles_guard_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from coaches c
             where c.user_id = auth.uid() and c.role = 'admin') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.is_approved is distinct from old.is_approved then
    raise exception 'Роль и одобрение профиля меняет только администратор';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive on public.profiles;
create trigger profiles_guard_sensitive
  before update on public.profiles
  for each row execute function public.profiles_guard_sensitive();

-- ============================================================================
-- 3. LESSON_CONTENT — платный контент не читается всеми (КРИТИЧНО)
-- ============================================================================

-- (раньше: "Anyone can view content" + anon-дубль — SELECT true для всех)
drop policy if exists "Allow public read access on lesson_content" on public.lesson_content;
drop policy if exists "Anyone can view content" on public.lesson_content;

-- Видно: владельцу урока, админу, бесплатному/превью-уроку, купившему урок,
-- и урокам опубликованных курсов (бесплатный курс / куплен курс / куплен урок / превью).
create policy lesson_content_read on public.lesson_content
  for select to authenticated, anon
  using (
    exists (
      select 1 from lessons l
      join coaches c on c.id = l.coach_id
      where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
    )
    or exists (
      select 1 from coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
    or exists (
      select 1 from lessons l
      where l.id = lesson_content.lesson_id
        and (l.price = 0 or l.is_free_preview)
    )
    or exists (
      select 1 from lessons l
      where l.id = lesson_content.lesson_id
        and exists (
          select 1 from purchases p
          where p.user_id = auth.uid() and p.lesson_id = l.id
            and p.payment_status = 'completed'
        )
    )
    or exists (
      select 1 from lessons l
      join course_lessons cl on cl.lesson_id = l.id
      join courses co on co.id = cl.course_id
      where l.id = lesson_content.lesson_id
        and co.is_published
        and (
          l.price = 0 or l.is_free_preview or co.price = 0
          or exists (
            select 1 from purchases p
            where p.user_id = auth.uid()
              and p.payment_status = 'completed'
              and (p.lesson_id = l.id or p.course_id = co.id)
          )
        )
    )
  );

-- ============================================================================
-- 4. PURCHASES — самопокупка (КРИТИЧНО)
-- ============================================================================

-- INSERT убираем совсем: покупки создаёт только платёжный сервер
-- через сервисный ключ (service_role не подчиняется RLS).
-- Когда появится платёжка — она пишет сервисным клиентом, политики не нужны.
drop policy if exists purchases_insert_own on public.purchases;

-- ============================================================================
-- 5. REPORTS / REVIEW_REPORTS — жалобы видят автор и админ (СРЕДНЕ)
-- ============================================================================

drop policy if exists "Anyone can view reports" on public.reports;
create policy reports_select_admin on public.reports
  for select to authenticated
  using (
    auth.uid() = reporter_id
    or exists (select 1 from public.coaches c
               where c.user_id = auth.uid() and c.role = 'admin')
  );

drop policy if exists "Anyone can view review reports" on public.review_reports;
create policy review_reports_select_admin on public.review_reports
  for select to authenticated
  using (
    auth.uid() = reporter_id
    or exists (select 1 from public.coaches c
               where c.user_id = auth.uid() and c.role = 'admin')
  );

-- ============================================================================
-- 6. LESSON_PROGRESS — «все видят всех» + дубли (СРЕДНЕ)
-- ============================================================================

-- SELECT: свои + наставники/админ (политика "Mentors can view all progress" остаётся)
drop policy if exists enable_select_for_all on public.lesson_progress;
drop policy if exists lesson_progress_select_own on public.lesson_progress;

-- INSERT: дубли → остаётся lesson_progress_insert_own
drop policy if exists "Users can create own progress" on public.lesson_progress;
drop policy if exists enable_insert_for_authenticated on public.lesson_progress;

-- UPDATE: дубли → остаётся lesson_progress_update_own
drop policy if exists "Users can update own progress" on public.lesson_progress;
drop policy if exists enable_update_for_authenticated on public.lesson_progress;

-- DELETE: остаётся "Users can delete own progress"

-- ============================================================================
-- 7. LIKES — вставка «кем угодно и от чужого имени» (СРЕДНЕ)
-- ============================================================================

drop policy if exists "Anyone can insert likes" on public.likes;
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (auth.uid() = user_id);

-- SELECT/DELETE остаются (счётчики публичные, удаление — своё)

-- ============================================================================
-- 8. STOP_LIST — запись/правка/удаление только админ (СРЕДНЕ)
--    SELECT остаётся публичным: BanCheck проверяет бан у любого посетителя
-- ============================================================================

drop policy if exists "Authenticated users can create stop list entries" on public.stop_list;
drop policy if exists enable_insert_for_authenticated on public.stop_list;
drop policy if exists stop_list_insert_own on public.stop_list;
-- остаётся "Admins can insert to stop_list"

drop policy if exists "Users can update own stop list entries" on public.stop_list;
drop policy if exists enable_update_for_authenticated on public.stop_list;
drop policy if exists "Users can update stop list" on public.stop_list;
create policy stop_list_admin_update on public.stop_list
  for update to authenticated
  using (exists (select 1 from public.coaches c
                 where c.user_id = auth.uid() and c.role = 'admin'))
  with check (exists (select 1 from public.coaches c
                 where c.user_id = auth.uid() and c.role = 'admin'));

drop policy if exists stop_list_delete_own on public.stop_list;
create policy stop_list_admin_delete on public.stop_list
  for delete to authenticated
  using (exists (select 1 from public.coaches c
                 where c.user_id = auth.uid() and c.role = 'admin'));

drop policy if exists enable_select_for_all on public.stop_list;
drop policy if exists stop_list_select_own on public.stop_list;
drop policy if exists "Public can view stop list" on public.stop_list;
-- остаётся "Anyone can view stop_list" (публичное чтение для BanCheck)

-- ============================================================================
-- 9. ANALYTICS_EVENTS — писать события можно только от своего имени
-- ============================================================================

drop policy if exists "Authenticated users can create analytics" on public.analytics_events;
create policy analytics_insert_own on public.analytics_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- ============================================================================
-- 10. MESSAGES — конфликтные дубли: остаётся UPDATE «только получатель»
--     (получатель ставит is_read; правка текста отправителем закрыта)
-- ============================================================================

drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can view their messages" on public.messages;
drop policy if exists "Users can view their own messages" on public.messages;
drop policy if exists "Users can update their messages" on public.messages;

-- ============================================================================
-- 11. COURSES — дубли: остаётся ALL-политика владельца + admin_all + публичное чтение
-- ============================================================================

drop policy if exists "Coaches can create courses" on public.courses;
drop policy if exists "Coaches can view own courses" on public.courses;
drop policy if exists "Coaches can update own courses" on public.courses;
drop policy if exists "Coaches can delete own courses" on public.courses;
drop policy if exists "Public can view published courses" on public.courses;

-- ============================================================================
-- 12. REVIEWS — дубли: по одной политике на операцию
-- ============================================================================

drop policy if exists "Users can delete own reviews" on public.reviews;
drop policy if exists "Users can delete their own review" on public.reviews;
drop policy if exists "Authenticated users can create reviews" on public.reviews;
drop policy if exists "Authenticated users can insert lesson reviews" on public.reviews;
drop policy if exists "Users can insert their own review" on public.reviews;
drop policy if exists "Anyone can view lesson reviews" on public.reviews;
drop policy if exists "Public can view reviews" on public.reviews;
drop policy if exists "Users can view all reviews" on public.reviews;
drop policy if exists "Users can update own lesson reviews" on public.reviews;
drop policy if exists "Users can update their own review" on public.reviews;
-- остаётся: reviews_insert_own / reviews_select_all / reviews_update_own / reviews_delete_own

commit;

-- ============================================================================
-- 13. ХВОСТ (выполнить после основного блока — имена дубликатов не совпали
--     с реальными, а аналитика от anon допускала запись от чужого user_id)
-- ============================================================================

begin;

-- Дубликаты, пережившие блоки 2 и 12 (имена в файле были неточны):
drop policy if exists "Users can update own reviews" on public.reviews;
drop policy if exists "Users can update stop_list" on public.stop_list;

-- Анонимная аналитика: можно писать только «безличные» события просмотра.
-- (старое: "Anyone can create profile views" — без ограничения user_id,
--  anon мог бы приписать событие любому пользователю)
drop policy if exists "Anyone can create profile views" on public.analytics_events;
create policy analytics_anon_insert_views on public.analytics_events
  for insert to anon
  with check (user_id is null and event_type in ('profile_view', 'lesson_view'));

commit;

-- ============================================================================
-- Проверка после выполнения (запустить отдельно):
--   select tablename, count(*) from pg_policies
--   where schemaname = 'public' group by 1 order by 2 desc;
-- Ожидание: coaches = 3 (insert_own, update_own, admin_update, guard — не политика),
--           reviews = 4, lesson_progress = 4, stop_list = 3, messages = 4.
--   И проверить работу: админка «Наставники» (кнопка «Проверен»), комментарии,
--   уроки (бесплатный + платный), лайки, «Мои обращения».
-- ============================================================================