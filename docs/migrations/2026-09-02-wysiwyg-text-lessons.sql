-- Миграция 2026-09-02: текстовые уроки (WYSIWYG)
-- Выполнена агентом через rpc exec_sql (функция в БД).
-- 1) Колонка для HTML текстового урока
-- 2) CHECK-ограничение content_type: добавить 'text'
--    (урок: CHECK-ограничения не видны в коде приложения — при новом
--    типе контента править и код, и ограничение в БД)

alter table lesson_content add column if not exists content_html text;

alter table lesson_content drop constraint if exists lesson_content_content_type_check;
alter table lesson_content add constraint lesson_content_content_type_check
  check (content_type = ANY (ARRAY[
    'video'::text, 'text'::text, 'pdf'::text,
    'image'::text, 'storage'::text, 'other'::text
  ]));