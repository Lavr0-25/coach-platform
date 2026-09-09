-- Техдолг «Storage»: широкая INSERT-политика в uploads (2026-09-09)
-- Запускать от postgres (SQL Editor) — обходит RLS.
-- Что меняется:
--   1) удалена политика "Allow authenticated upload to uploads" — разрешала
--      ЗАЛОГИНЕННОМУ пользователю загрузить в публичный бакет uploads файл
--      ЛЮБОГО типа (судя по имени, создана дашбордом Supabase при правке
--      бакета). Нормальная политика "Authenticated users can upload images"
--      (только jpg/jpeg/png/gif/webp) остаётся и продолжает работать.
--   2) защита в глубину: allowed_mime_types прописаны в самих бакетах —
--      валидация MIME не зависит от политик (политика смотрит только
--      расширение имени; бакет смотрит реальный content-type, который
--      браузер ставит из file.type).
-- SELECT-политики проверены живьём (MCP, 2026-09-09): все три уже сужены
-- по bucket_id — хвост техдолга "широкая SELECT-политика" закрыт ранее.
-- Бакет avatars удалён из дашборда, бакетов ровно 3.

begin;

-- 1. Широкая INSERT-политика (без ограничения типа файла)
drop policy if exists "Allow authenticated upload to uploads"
  on storage.objects;

-- 2. Разрешённые MIME на уровне бакетов
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
where id in ('covers', 'uploads');

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
where id = 'lesson_files';

commit;

-- Контроль после запуска (ожидания):
--   политик 11 (было 12), в uploads единственная INSERT —
--   "Authenticated users can upload images";
--   allowed_mime_types: covers/uploads = 4 картинки, lesson_files = 4 + pdf.
--   select policyname, cmd from pg_policies
--     where schemaname = 'storage' and tablename = 'objects' order by cmd;
--   select id, allowed_mime_types from storage.buckets order by id;