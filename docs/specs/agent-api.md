# Спека: агентское API (`/api/agent/*`)

> Статус: `draft` · обновлено 2026-09-03 · ответственный: Анатолий + Claude Code

## Назначение

Узкое API для ИИ-агента (Claude Code или аналог):
- ступень 1 — читает обращения и жалобы, строит сводки, проставляет статусы
  (без ручной выгрузки JSON; паттерн скилла `agent-admin-api`);
- ступень 2 — «ИИ-завод контента»: агент каждого автора по своему ключу берёт
  темы из его плана, пишет текстовые уроки и публикует их по расписанию
  (см. разделы «ИИ-завод» ниже).

## Ключи: в базе, привязаны к пользователю

- Управление ключами — страница `/dashboard/ai/keys` (раздел «Управление с ИИ»,
  доступен любому залогиненному; старый адрес `/api-keys` — редирект):
  создать ключ (виден один раз), список СВОИХ ключей, отзыв. Ссылка в меню профиля.
- Таблица `agent_keys`: `key_hash` (sha256, сами ключи не хранятся), `user_id`,
  `name`, `created_at`, `last_used_at`, `revoked_at`. RLS включена, политик нет —
  таблицу читает/пишет только сервер через сервисный ключ.
- Создание/список/отзыв — server actions (`app/actions/agentKeyActions.ts`):
  проверка входа вручную, операции через сервисный клиент, фильтр по владельцу.
- Отзыв ключа закрывает доступ мгновенно, без передеплоя.

## Аутентификация и права (lib/agentAuth.ts)

1. Ключ из заголовка `x-agent-key` хэшируется и ищется в `agent_keys`
   (не отозванный) — через сервисный клиент.
2. Сервер входит в Supabase под владельцем ключа (magic link без письма) —
   все запросы агента идут с его правами через RLS.
3. Роль владельца (`coaches.role`) определяет объём:
   - **admin** — все обращения, смена статусов, жалобы (чтение + закрытие);
   - **остальные** — только ЧТЕНИЕ СВОИХ обращений (сводка помечена
     `scope: "owner"`); PATCH и жалобы → 403.
4. Требуется `SUPABASE_SERVICE_ROLE_KEY` на сервере (`.env.local` локально,
   Secret/Production в Vercel): без него API отвечает 503.

## Endpoints

### `GET /api/agent/feedback?status=new|in_progress|resolved|rejected&limit=N`

→ `{ scope, total, counts: {new, in_progress, resolved, rejected}, items: [...] }`
items — записи feedback (id, type bug|feature, title, description, status, user_id,
user_name, images[] — публичные URL Storage, created_at, updated_at), новые сверху. limit ≤ 500.

### `PATCH /api/agent/feedback` — только admin

Тело `{ "id": uuid, "status": "...", "reply": "текст ответа" }` → `{ ok, id, status, reply }`.
- `status` обязателен; `reply` — необязательный ответ пользователю
  («Решено 02.09, спасибо…» или «Недостаточно данных: …»). Ответ виден
  пользователю в «Мои обращения» (`app/feedback`), пишется в поля
  `admin_reply` / `replied_at` таблицы feedback.
- Пустой `reply` (`""`) стирает предыдущий ответ.
- Валидация статуса (400), не-админ (403), несуществующий id (404).

Админка и API меняют статус одинаково (одинаковый payload), чтобы ответ,
оставленный через админку, и через агента не расходились.

### `GET /api/agent/reports` — только admin

→ `{ summary: { comment_reports, review_reports, total, by_reported_user: [...] },
comment_reports: [...], review_reports: [...] }`
Имена участников раскрываются из coaches по reporter_id / reported_user_id (как в /admin/reports).

### `DELETE /api/agent/reports?table=comment|review&id=uuid` — только admin

Закрыть (удалить) жалобу — то же, что кнопка «Удалить» в /admin/reports → `{ ok, id }`.

## ИИ-завод контента (ступень 2, 2026-09-03)

Конвейер: автор ведёт **план тем** в разделе «Управление с ИИ» (`/dashboard/ai/topics`,
таблица
`lesson_topics`), его агент по расписанию (Claude Code на компьютере автора,
Windows планировщик) берёт следующую тему, пишет текстовый урок (Tiptap HTML)
и публикует. Гибрид тем: пустой `title` = «агент предложит сам» (по `notes`
или по профилю автора); автор может вообще не вести план — тогда агент
руководствуется заданием, полученным от автора в своей системе.

Жизненный цикл темы: `queued` → `in_progress` → `published` (или `skipped`).
Тема хранит `lesson_id` созданного по ней урока и `suggested_by`
(author | agent). RLS `lesson_topics_*_own`: только свой кабинет
(`coaches.user_id = auth.uid()`) — для автора и для агента (агент работает
под сессией владельца ключа).

### `GET /api/agent/topics[?status=queued|in_progress|published|skipped]`

→ `{ total, counts: {queued, in_progress, published, skipped}, next_queued, items }`.
`next_queued` — первая тема в очереди (подсказка агенту, что брать).

### `POST /api/agent/topics` — агент предлагает тему сам

Тело `{ "title": "...", "notes": "пожелания" }` (хотя бы одно поле) → 201 `{ ok, topic }`.
`suggested_by` всегда `agent`. Нужен `coach_id`? Нет — сервер берёт его по
владельцу ключа, из тела не принимается.

### `PATCH /api/agent/topics`

Тело `{ "id", "title?", "notes?", "status?", "lesson_id?" }` → `{ ok, topic }`.
Так агент берёт тему в работу (`status: "in_progress"`) и отмечает публикацию
(`status: "published"`). 400 — неверный статус, 404 — чужая/несуществующая.

### `POST /api/agent/lessons` — создать черновик текстового урока

Тело `{ "topic_id?", "title", "description?", "html" }` → 201 `{ ok, lesson: {id, title, is_published, created_at}, published: false }`.
- `html` очищается на сервере через схему Tiptap (`lib/editor/sanitizeLessonHtml.ts`,
  XSS-защита: script/onclick/javascript:/чужие iframe отбрасываются).
- Урок создаётся **черновиком** (`is_published=false`), цена 0 (автоконтент
  бесплатный — цену ставит автор вручную).
- При `topic_id` тема переходит в `in_progress` и привязывается к уроку.
- 422 — html пуст/не распознан, текст короче 2000 символов вне тегов
  (`MIN_CONTENT_CHARS`), найдено запрещённое слово (`banned_words`, проверка по
  заголовку+описанию+тексту). Черновик при провале ворот объёма/слов НЕ создаётся —
  агент получает причину и должен исправить текст и повторить.

### `PATCH /api/agent/lessons` — опубликовать черновик

Тело `{ "id", "publish": true }` → `{ ok, lesson, published: true }`.
Повторные ворота (объём, запрещённые слова — черновик мог быть написан до
пополнения стоп-листа) + дневной лимит `MAX_PUBLISH_PER_DAY = 3` автопубликаций
на автора в сутки (счёт по темам со `status='published'` и `updated_at >=` начала
суток; 429 при превышении). Публикация помечает тему «published».
Публиковать можно только текстовые уроки агента (422 для остальных).

## Границы (осознанно НЕ входит)

- **Блокировки пользователей** — нет. Сначала методика модерации
  (`moderation.md`, «рекомендую бан»), решение за человеком; автоматика — позже, отдельно.
- **Автопубликация не-текстовых уроков** — нет; платформа движется к «только
  текстовые уроки с WYSIWYG» (решение 2026-09-03).
- Ступень 1: не-админам — только чтение своих данных; запись (статусы, удаление
  жалоб) — только админским ключам.
- Ступень 2: доступ к контенту — только СВОИ темы и уроки (RLS), дневной лимит
  и минимальный объём не отключаемы (константы в `app/api/agent/lessons/route.ts`).

## RLS-политики feedback (проверено 2026-09-02)

Ранний набор политик был неполным — у пользователя не было UPDATE/DELETE своих
строк (кнопки «Редактировать»/«Удалить» в «Мои обращения» тихо не работали).
Актуальный полный набор (7 политик):

| cmd | Политика | Условие |
|---|---|---|
| SELECT | Users can view own feedback | `auth.uid() = user_id` |
| SELECT | Admins can view all feedback | роль admin в coaches |
| INSERT | Users can create feedback | with_check: `auth.uid() = user_id` |
| UPDATE | Users can update own new feedback | using: своё + `status='new'`; with_check: своё |
| UPDATE | Admins can update feedback | роль admin |
| DELETE | Users can delete own new feedback | своё + `status='new'` |
| DELETE | Admins can delete feedback | роль admin |

Правило: пользователь редактирует/удаляет СВОЁ обращение, пока оно «Новое»;
после взятия в работу правит только админ. Это же условие дублируется в коде
(server actions) — двойная проверка, RLS последняя линия обороны.

⚠️ Урок: при включении RLS сразу проверять ВСЕ 4 команды (SELECT/INSERT/
UPDATE/DELETE) для каждой роли. Отсутствие политики = тихий отказ без ошибки.

## История

- 2026-09-03 — раздел «Управление с ИИ» (`/dashboard/ai`): хаб + «План тем»
  (`/dashboard/ai/topics`) и «API-ключи агента» (`/dashboard/ai/keys`).
  Старые адреса `/api-keys` и `/dashboard/mentor/topics` — редиректы.
- 2026-09-03 — ступень 2 «ИИ-завод»: `lesson_topics` (миграция 2026-09-03-lesson-topics.sql),
  страница плана тем в кабинете, `/api/agent/topics` (GET/POST/PATCH),
  `/api/agent/lessons` (POST черновик / PATCH публикация) с воротами качества
  (Tiptap-санитизация, ≥2000 символов, banned_words, ≤3 автопубликаций/день).
- 2026-09-02 — создано (feedback GET/PATCH, reports GET/DELETE), ключ в Vercel (Secret, Production).
- 2026-09-02 — ключи переехали в базу (`agent_keys`, хэши, страница `/api-keys` для всех
  пользователей, развилка по роли admin/остальные, сервисный ключ в env; старый AGENT_KEY
  из env и страница /admin/agent-keys удалены).
- 2026-09-02 — PATCH: ответ пользователю (`reply` → `admin_reply`/`replied_at`);
  админка (/admin/feedback) и «Мои обращения» (/feedback) показывают ответ в плашке.
  Починены RLS-политики feedback (UPDATE/DELETE своими, см. раздел выше).