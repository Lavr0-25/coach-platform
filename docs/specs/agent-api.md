# Спека: агентское API (`/api/agent/*`)

> Статус: `draft` · обновлено 2026-09-02 · ответственный: Анатолий + Claude Code

## Назначение

Узкое API для ИИ-агента (Claude Code): читает обращения и жалобы, строит сводки,
проставляет статусы — без ручной выгрузки JSON. Паттерн зафиксирован скиллом
`agent-admin-api` (глобальный, переносится в другие проекты Анатолия).

## Ключи: в базе, привязаны к пользователю

- Управление ключами — страница `/api-keys` (доступна любому залогиненному):
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

## Границы (осознанно НЕ входит)

- **Блокировки пользователей** — нет. Ступень 2: сначала методика модерации
  (`moderation.md`, «рекомендую бан»), решение за человеком; автоматика — позже, отдельно.
- Не-админам — только чтение своих данных; запись (статусы, удаление жалоб) —
  только админским ключам. Новые возможности для обычных ключей — позже
  (анонсировано на странице /api-keys).
- Доступ только к feedback + reports. Остальные таблицы агенту недоступны.

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

- 2026-09-02 — создано (feedback GET/PATCH, reports GET/DELETE), ключ в Vercel (Secret, Production).
- 2026-09-02 — ключи переехали в базу (`agent_keys`, хэши, страница `/api-keys` для всех
  пользователей, развилка по роли admin/остальные, сервисный ключ в env; старый AGENT_KEY
  из env и страница /admin/agent-keys удалены).
- 2026-09-02 — PATCH: ответ пользователю (`reply` → `admin_reply`/`replied_at`);
  админка (/admin/feedback) и «Мои обращения» (/feedback) показывают ответ в плашке.
  Починены RLS-политики feedback (UPDATE/DELETE своими, см. раздел выше).