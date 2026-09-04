-- №7: сужение политик Storage (бэклог), 2026-09-04
-- Запускать от postgres (SQL Editor) — обходит RLS.
-- Что меняется: закрыта анонимная загрузка в uploads, UPDATE/DELETE
-- covers/lesson_files требуют владельца, avatars (пустой, не используется)
-- удалён, типы файлов lesson_files ограничены, серверные лимиты размера.
-- Публичное чтение (SELECT) не меняем: бакеты public, картинки рендерятся
-- по прямым ссылкам (getPublicUrl).

begin;

-- 1. Бакет avatars (0 объектов, код не использует — аватарки идут в covers):
--    удалить через SQL нельзя (storage.protect_delete разрешает удаление
--    из storage.* только через Storage API). Удаляем его мусорные политики,
--    сам бакет Анатолий удалит в дашборде: Storage → avatars → Delete bucket.
drop policy if exists "Public Access for avatars" on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Users can update own avatars" on storage.objects;

-- 2. Мусорные политики
-- роль public + проверка owner = auth.uid(): никогда не срабатывает
drop policy if exists "Users can delete own images" on storage.objects;
-- дубль «Allow public read from uploads»
drop policy if exists "Users can view images" on storage.objects;

-- 3. uploads: закрыть анонимную загрузку (была роль public)
drop policy if exists "Users can upload images" on storage.objects;
create policy "Authenticated users can upload images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and lower(substring(name from position('.' in name) + 1))
        in ('jpg', 'jpeg', 'png', 'gif', 'webp')
  );

-- 4. covers: UPDATE/DELETE — только владелец (было: любой authenticated)
drop policy if exists "Users can update own covers" on storage.objects;
create policy "Users can update own covers"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and owner = auth.uid());

drop policy if exists "Users can delete own covers" on storage.objects;
create policy "Users can delete own covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and owner = auth.uid());

-- 5. lesson_files: только картинки и PDF (было: любые файлы),
--    UPDATE/DELETE — только владелец
drop policy if exists "Authenticated users can upload lesson files" on storage.objects;
create policy "Authenticated users can upload lesson files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lesson_files'
    and lower(substring(name from position('.' in name) + 1))
        in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf')
  );

drop policy if exists "Users can update own lesson files" on storage.objects;
create policy "Users can update own lesson files"
  on storage.objects for update to authenticated
  using (bucket_id = 'lesson_files' and owner = auth.uid());

drop policy if exists "Users can delete own lesson files" on storage.objects;
create policy "Users can delete own lesson files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'lesson_files' and owner = auth.uid());

-- 6. Серверные лимиты размера (раньше только на клиенте): 5 МБ —
--    скрины обращений и обложки, 10 МБ — картинки уроков (как в коде)
update storage.buckets set file_size_limit = 5242880  where id = 'uploads';
update storage.buckets set file_size_limit = 5242880  where id = 'covers';
update storage.buckets set file_size_limit = 10485760 where id = 'lesson_files';

commit;

-- Контроль (проверено 2026-09-04): политик 12 (было 16), у всех
-- UPDATE/DELETE в USING есть owner = auth.uid(); file_size_limit: covers/uploads
-- 5 МБ, lesson_files 10 МБ. Загрузки обложки и скрина обращения проверены
-- в браузере — работают.
-- Бакет avatars остался (SQL-удаление блокирует storage.protect_delete):
-- удалить в дашборде → Storage → avatars → Delete bucket (пустой).