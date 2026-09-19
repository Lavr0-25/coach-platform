-- Фикс очереди ТГ (№20): секрет триггера в system_settings + RLS, 2026-09-19
-- Проблема 1: секрет CRON_SECRET из миграции 2026-09-13 так и не был вписан
--   в pg_cron-задачу (там осталась заглушка ЗАМЕНИ_НА_СЕКРЕТ) — все
--   15-минутные вызовы Vercel-функции получали 401, публикация молча
--   деградировала до ежедневного резервного Vercel Cron.
-- Решение 1: секрет хранится в system_settings (key='cron_secret') — единый
--   источник: pg_cron читает его из таблицы в момент пинга, функция сверяет
--   с той же таблицей (env CRON_SECRET остаётся запасным для Vercel Cron).
--
-- Проблема 2: политика «Public can view settings» (SELECT using true) —
--   anon-ключ мог прочитать весь system_settings, включая cron_secret
--   (проверено: HTTP 200 с anon-ключом). После применения — ротация секрета.
-- Решение 2: публичное чтение только для не-секретных ключей
--   (auto_ban_threshold, facsimile_url — их читают клиентские компоненты),
--   остальное — только админ; сервисный ключ и pg_cron (postgres) RLS
--   не применяют и работают как раньше.

-- 1. RLS: закрыть публичное чтение (запускать от postgres)
drop policy if exists "Public can view settings" on public.system_settings;

create policy "settings_public_keys_select" on public.system_settings
  for select to public
  using (key in ('auto_ban_threshold', 'facsimile_url'));

create policy "settings_admin_select" on public.system_settings
  for select to authenticated
  using (
    exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid() and c.role = 'admin'
    )
  );

-- 2. Переподключение pg_cron-задачи: секрет из таблицы, а не литералом.
--    cron.schedule сам коммитит — запускать ВНЕ транзакции.
select cron.unschedule('publish-scheduled-posts')
where exists (select 1 from cron.job where jobname = 'publish-scheduled-posts');

select cron.schedule(
  'publish-scheduled-posts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://www.myrightway.ru/api/cron/publish-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value#>>'{}' from system_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Контроль после применения:
--   select jobid, schedule, command from cron.job where jobname = 'publish-scheduled-posts';
--   -- в command НЕ должно быть литерального секрета, только подзапрос к system_settings
-- Аноним больше не читает секрет (ожидание: пустой массив или 0 строк):
--   curl -s "https://ftokvvzgvzkphszgfjbi.supabase.co/rest/v1/system_settings?key=eq.cron_secret&select=key" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
-- Ротация секрета после этого скрипта — отдельным шагом (агент, через сервисный ключ).