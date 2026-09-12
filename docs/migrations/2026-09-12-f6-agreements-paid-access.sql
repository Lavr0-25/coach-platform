-- ============================================================================
-- Ф6.1: Оферта + заявка на платный контент (RightWay / coach-platform)
-- Дата: 2026-09-12 · Спека: docs/specs/payments.md · Статус: НА СОГЛАСОВАНИЕ
-- Применяет: Анатолий в SQL Editor Supabase (MCP-коннект агента read-only)
-- Идемпотентность: повторный запуск безопасен (IF NOT EXISTS / WHERE NOT EXISTS).
--
-- Что закладывает:
--   1) mentor_agreements   — лицензионный договор ментора (оферта-акцепт v1,
--                            текст: tmp/contract-mentor-offer-v1.md);
--   2) paid_access_requests — заявка ментора на платный контент (ИНН + скан);
--   3) mentor_agreement_files — версии файлов договора (скан ментора, финал
--                            с двумя подписями); приватный Storage-бакет.
--
-- Решения 12.09 (разговор с Анатолием):
--  - Гибрид подписания: основной путь — оферта-акцепт (кнопка в кабинете),
--    скан — ручной путь, ЭЦП — будущая фаза (поле signature_type уже есть).
--  - Рефералка: −5 п.п., каждый новый реферал продлевает срок на 1 месяц
--    (см. спеку payments.md, раздел «Комиссия платформы»).
--  - Правило «флаг включается только при active-договоре и approved-заявке» —
--    реализуется в КОДЕ (server action админа), не триггером БД.
--
-- Конвенции проекта (как в 2026-09-10-payments-f1.sql):
--  - FK-констрейнтов нет (целостность на уровне приложения).
--  - coach_user_id = auth user_id ментора (как в subscriptions/paid_subscriptions).
--  - Админ-проверка в RLS: exists (select 1 from coaches c
--    where c.user_id = auth.uid() and c.role = 'admin').
-- ============================================================================


-- ============================================================================
-- Блок 1. Таблица договоров (mentor_agreements)
-- ============================================================================
-- Одна строка на ментора (уникальный индекс), переиспользуется: после
-- расторжения и повторного акцепта строка не плодится — сервер создаёт новую
-- только при отсутствии. contract_number NULL до одобрения заявки админом;
-- номер вида 'ЛД-2026-001' присваивает сервер при одобрении (уникальность
-- гарантирует индекс).
-- signature_type: offer_acceptance (кнопка) / scan (скан, ручной путь) /
-- ecp (заложено под будущую интеграцию ЭЦП).
CREATE TABLE IF NOT EXISTS public.mentor_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL,      -- ментор (auth.users)
  offer_version text NOT NULL DEFAULT '1.0',
  signature_type text NOT NULL DEFAULT 'offer_acceptance'
    CHECK (signature_type IN ('offer_acceptance', 'scan', 'ecp')),
  contract_number text,             -- NULL до одобрения; потом 'ЛД-2026-001'
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'terminated')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  accept_ip text,                   -- фиксация акцепта (защита при спорах)
  accept_user_agent text,
  terminated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Один договор на ментора.
CREATE UNIQUE INDEX IF NOT EXISTS mentor_agreements_coach_uniq
  ON public.mentor_agreements (coach_user_id);
-- Номер договора уникален (NULL у неподтверждённых не мешают).
CREATE UNIQUE INDEX IF NOT EXISTS mentor_agreements_number_uniq
  ON public.mentor_agreements (contract_number) WHERE contract_number IS NOT NULL;

-- RLS: ментор читает и создаёт свой договор (акцепт — INSERT со своего
-- токена). UPDATE клиенту НЕ даём намеренно: статус/номер/тип подписи
-- меняет только админ; расторжение по инициативе ментора пойдёт через
-- серверный код (service role). Админ — полный доступ.
ALTER TABLE public.mentor_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agreements_coach_select" ON public.mentor_agreements;
CREATE POLICY "agreements_coach_select" ON public.mentor_agreements
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "agreements_coach_insert" ON public.mentor_agreements;
CREATE POLICY "agreements_coach_insert" ON public.mentor_agreements
  FOR INSERT WITH CHECK (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "agreements_admin_all" ON public.mentor_agreements;
CREATE POLICY "agreements_admin_all" ON public.mentor_agreements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 2. Заявки на платный контент (paid_access_requests)
-- ============================================================================
-- Ментор подаёт заявку: ИНН (для проверки статуса самозанятого) + комментарий
-- + скан подписанного договора (в бакет, блок 4). Статусы:
--   submitted — на проверке; approved — одобрена; returned — возвращена
--   (обязательный admin_comment — причина, ментор видит и подаёт заново).
-- Одновременно может быть только одна открытая (submitted) заявка ментора.
CREATE TABLE IF NOT EXISTS public.paid_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL,      -- заявитель (auth.users)
  inn text NOT NULL CHECK (inn ~ '^[0-9]{10}$|^[0-9]{12}$'),
  mentor_comment text,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'approved', 'returned')),
  admin_comment text,               -- причина возврата (обязательна при returned)
  decided_by uuid,                  -- админ, принявший решение
  decided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paid_access_requests_coach_idx
  ON public.paid_access_requests (coach_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS paid_access_requests_status_idx
  ON public.paid_access_requests (status, created_at DESC);
-- Одна открытая заявка на ментора.
CREATE UNIQUE INDEX IF NOT EXISTS paid_access_requests_open_uniq
  ON public.paid_access_requests (coach_user_id) WHERE status = 'submitted';

-- RLS: ментор видит свои заявки и подаёт новые (только в статусе submitted —
-- «сразу одобренную» с клиента вставить нельзя). Решение — только админ.
ALTER TABLE public.paid_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_requests_coach_select" ON public.paid_access_requests;
CREATE POLICY "access_requests_coach_select" ON public.paid_access_requests
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "access_requests_coach_insert" ON public.paid_access_requests;
CREATE POLICY "access_requests_coach_insert" ON public.paid_access_requests
  FOR INSERT WITH CHECK (auth.uid() = coach_user_id AND status = 'submitted');

DROP POLICY IF EXISTS "access_requests_admin_all" ON public.paid_access_requests;
CREATE POLICY "access_requests_admin_all" ON public.paid_access_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 3. Файлы договора (mentor_agreement_files)
-- ============================================================================
-- История версий: старые файлы не удаляются. kind:
--   mentor_scan  — скан, подписанный ментором (грузит ментор);
--   final_signed — финальная версия с двумя подписями (грузит админ).
-- storage_path — ключ в бакете mentor-agreements (блок 4):
--   '{coach_user_id}/{agreement_id}/{файл}'.
CREATE TABLE IF NOT EXISTS public.mentor_agreement_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL,       -- ссылка на mentor_agreements.id
  coach_user_id uuid NOT NULL,      -- денормализация для простых RLS/выборок
  kind text NOT NULL CHECK (kind IN ('mentor_scan', 'final_signed')),
  storage_path text NOT NULL,
  original_name text,
  uploaded_by uuid NOT NULL,        -- кто загрузил (ментор или админ)
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agreement_files_agreement_idx
  ON public.mentor_agreement_files (agreement_id, uploaded_at DESC);

-- RLS: файлы договора видит владелец и админ; грузит — владелец (скан) и
-- админ (финал); удалять/править клиенту нельзя (история версий).
ALTER TABLE public.mentor_agreement_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agreement_files_coach_select" ON public.mentor_agreement_files;
CREATE POLICY "agreement_files_coach_select" ON public.mentor_agreement_files
  FOR SELECT USING (auth.uid() = coach_user_id);

DROP POLICY IF EXISTS "agreement_files_coach_insert" ON public.mentor_agreement_files;
CREATE POLICY "agreement_files_coach_insert" ON public.mentor_agreement_files
  FOR INSERT WITH CHECK (auth.uid() = coach_user_id AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "agreement_files_admin_all" ON public.mentor_agreement_files;
CREATE POLICY "agreement_files_admin_all" ON public.mentor_agreement_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.role = 'admin')
  );


-- ============================================================================
-- Блок 4. Приватный Storage-бакет mentor-agreements
-- ============================================================================
-- PDF-сканы договоров — приватные (public = false), читать объект может
-- только владелец папки и админ. Лимит 10 МБ, только PDF.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'mentor-agreements', 'mentor-agreements', false, 10485760,
       ARRAY['application/pdf']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'mentor-agreements'
);

-- Политики storage.objects: путь {coach_user_id}/... — первая папка = auth user_id.
-- Чтение: владелец папки или админ.
DROP POLICY IF EXISTS "agreements_bucket_read" ON storage.objects;
CREATE POLICY "agreements_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mentor-agreements'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.role = 'admin'
      )
    )
  );

-- Загрузка: ментор — в свою папку (скан), админ — куда угодно (финал).
DROP POLICY IF EXISTS "agreements_bucket_insert" ON storage.objects;
CREATE POLICY "agreements_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mentor-agreements'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.role = 'admin'
      )
    )
  );

-- Изменение/удаление: только админ (история версий защищена).
DROP POLICY IF EXISTS "agreements_bucket_update" ON storage.objects;
CREATE POLICY "agreements_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mentor-agreements'
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "agreements_bucket_delete" ON storage.objects;
CREATE POLICY "agreements_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mentor-agreements'
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.role = 'admin'
    )
  );


-- ============================================================================
-- Блок 5. Проверка после применения (запустите отдельно, ошибок быть не должно)
-- ============================================================================
-- 1) Таблицы:
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public'
--    AND table_name IN ('mentor_agreements','paid_access_requests','mentor_agreement_files');
-- Ожидаем 3 строки.
--
-- 2) RLS включён:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('mentor_agreements','paid_access_requests','mentor_agreement_files');
-- Ожидаем relrowsecurity = true у всех трёх.
--
-- 3) Бакет:
-- SELECT id, public, file_size_limit, allowed_mime_types
--  FROM storage.buckets WHERE id = 'mentor-agreements';
-- Ожидаем 1 строку, public = false, mime = {application/pdf}.
--
-- 4) ИНН-проверка (грамматика):
-- SELECT '5047113440' ~ '^[0-9]{10}$|^[0-9]{12}$';   -- true
-- SELECT 'abc' ~ '^[0-9]{10}$|^[0-9]{12}$';          -- false