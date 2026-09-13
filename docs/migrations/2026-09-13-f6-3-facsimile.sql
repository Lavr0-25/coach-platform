-- Ф6.3 «Факсимиле Платформы» (бэклог №25), 2026-09-13
-- Запускать от postgres (SQL Editor) — обходит RLS.
-- Что добавляется:
--   1. Бакет brand — картинка факсимиле (печать+роспись ООО «Проинфо»):
--      публичное чтение (рендерится на /offer-mentor/print без авторизации),
--      запись/удаление — только админ (coaches.role='admin'), только PNG/JPEG.
--   2. paid_access_requests.facsimile_requested — автор попросил факсимиле
--      галочкой в заявке на платные продажи (флаг живёт в заявке: автор
--      создаёт её INSERT'ом, обновлять договор он права не имеет).
--   3. system_settings.facsimile_url — публичный URL картинки; ключа нет =
--      факсимиле не загружено (у авторов ничего не показываем).
-- Применено 2026-09-13 (Анатолий, SQL Editor; длинные скрипты в редакторе
-- режутся — применяли тремя кусками; в скрипте ниже рабочий вариант:
-- ARRAY[...] без приведения ::text[] и insert через where not exists).
-- Доработка 2026-09-13 (после теста): флаг перенесён с mentor_agreements
-- на paid_access_requests (у автора нет UPDATE-политики на договор — update
-- под его токеном молча не срабатывал; кусок №2 ниже).

begin;

-- 1. Бакет brand: создать, если нет
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'brand', 'brand', true, 2097152, ARRAY['image/png','image/jpeg']
where not exists (select 1 from storage.buckets where id = 'brand');

-- 1а. Если уже есть — обновить параметры
update storage.buckets
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png','image/jpeg']
where id = 'brand';

-- 2. Политики бакета: чтение — всем, запись/замена/удаление — админу.
--    Проверка роли обращается к таблице coaches (не к storage.objects),
--    поэтому рекурсии RLS (42P17) здесь нет.
drop policy if exists "Public read brand" on storage.objects;
create policy "Public read brand"
  on storage.objects for select to public
  using (bucket_id = 'brand');

drop policy if exists "Admin write brand" on storage.objects;
create policy "Admin write brand"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand'
    and exists (
      select 1 from coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

drop policy if exists "Admin update brand" on storage.objects;
create policy "Admin update brand"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand'
    and exists (
      select 1 from coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

drop policy if exists "Admin delete brand" on storage.objects;
create policy "Admin delete brand"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand'
    and exists (
      select 1 from coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

-- 3. Запрос факсимиле в заявке на платные продажи:
--    флаг живёт в заявке (автор делает INSERT заявки — политика уже есть).
alter table paid_access_requests
  add column if not exists facsimile_requested boolean not null default false;

-- 3а. Первоначальный вариант хранить флаг на договоре оказался нерабочим
--     (RLS: у автора нет UPDATE-политики) — колонку на договоре убираем.
alter table mentor_agreements
  drop column if exists facsimile_requested;

-- 4. Настройка: URL факсимиле. Строку создаёт код при первой загрузке;
--    здесь её нет — факсимиле «не загружено». (Ключ один: есть и непуст = активно;
--    «Убрать» пишет пустое значение — DELETE-политики на system_settings нет.)

commit;

-- Контроль (проверено 2026-09-13): buckets.brand → true, 2097152,
-- {image/png,image/jpeg}; политик brand — 4; paid_access_requests.
-- facsimile_requested — boolean default false; в mentor_agreements колонки нет.