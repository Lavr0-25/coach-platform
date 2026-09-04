-- Чистка тестовых данных прод-БД (бэклог №3), 2026-09-04
-- Согласовано с Анатолием: июльский мусор удаляем, сентябрьский
-- демо-слой комментариев/отзывов (>= 2026-09-01) оставляем до запуска.
-- Запускать от postgres (SQL Editor) — обходит RLS.

begin;

-- 1. Урок-призрак «Брюшной мышечный блок» (coach_id = null, 29.06.2026)
delete from public.lesson_content where lesson_id = '5f220f5c-4ded-4662-b7eb-b8f4e27393dd';
delete from public.lessons       where id = '5f220f5c-4ded-4662-b7eb-b8f4e27393dd';

-- 2. Комментарии: июльский мусор (демо-слой сентября остаётся)
delete from public.comments where created_at < '2026-09-01';

-- 3. Отзывы: июльские (сентябрьские демо остаются)
delete from public.reviews where created_at < '2026-09-01';

-- 4. Тестовая активность: лайки, избранное, прогресс
delete from public.likes;
delete from public.favorites;
delete from public.lesson_progress;

-- 5. Жалобы, тестовый бан, подписки на несуществующих коучей, уведомления
delete from public.reports;
delete from public.user_bans;
delete from public.subscriptions;
delete from public.notifications;

-- 6. Тестовая аналитика (искажает метрики)
delete from public.analytics_events;

-- 7. Отозванные API-ключи (активные не трогаем)
delete from public.agent_keys where revoked_at is not null;

commit;

-- Контроль после чистки (ожидаемо):
--   lessons: 12 (без «Брюшного мышечного блока»)
--   comments: 5, reviews: 2 (сентябрьский демо-слой)
--   likes/favorites/lesson_progress/reports/user_bans/subscriptions/
--   notifications/analytics_events: 0
--   agent_keys: 2 (оба активные)

-- Дополнение (после контрольной сверки): «Проверкакпк» (01.09) — мусор,
-- формально прошедший границу дат. Удалён вручную 2026-09-04:
-- delete from public.comments where id = '7faf2221-e128-4053-86c3-81a5b929389a';