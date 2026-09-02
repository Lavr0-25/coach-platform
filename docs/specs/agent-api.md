# Спека: агентское API (`/api/agent/*`)

> Статус: `draft` · обновлено 2026-09-02 · ответственный: Анатолий + Claude Code

## Назначение

Узкое API для агента (Claude Code): сам читает обращения и жалобы, строит сводки,
проставляет статусы — без ручной выгрузки JSON. Паттерн зафиксирован скиллом
`agent-admin-api` (глобальный, переносится в другие проекты Анатолия).

## Аутентификация

- Заголовок `x-agent-key` = переменная окружения `AGENT_KEY` (`.env.local` локально,
  Environment Variables в Vercel на проде; тип Secret, только Production).
- Проверка: `lib/agentAuth.ts` → 401 (нет/неверный ключ), 503 (ключ не настроен).
- Ротация: сгенерировать новый `AGENT_KEY`, обновить `.env.local` + Vercel, Redeploy.

## Endpoints

### `GET /api/agent/feedback?status=new|in_progress|resolved|rejected&limit=N`

→ `{ total, counts: {new, in_progress, resolved, rejected}, items: [...] }`
items — записи feedback (id, type bug|feature, title, description, status, user_id,
user_name, images[] — публичные URL Storage, created_at, updated_at), новые сверху. limit ≤ 500.

### `PATCH /api/agent/feedback`

Тело `{ "id": uuid, "status": "new|in_progress|resolved|rejected" }` → `{ ok, id, status }`.
Валидация статуса (400), несуществующий id (404).

### `GET /api/agent/reports`

→ `{ summary: { comment_reports, review_reports, total, by_reported_user: [{user_id, name, count}] },
comment_reports: [...], review_reports: [...] }`
Имена участников раскрываются из coaches по reporter_id / reported_user_id (как в /admin/reports).

### `DELETE /api/agent/reports?table=comment|review&id=uuid`

Закрыть (удалить) жалобу — то же, что кнопка «Удалить» в /admin/reports → `{ ok, id }`.

## Границы (осознанно НЕ входит)

- **Блокировки пользователей** — нет. Ступень 2: сначала методика модерации
  (`moderation.md`, «рекомендую бан»), решение за человеком; автоматика — позже, отдельно.
- Доступ только к feedback + reports. Остальные таблицы (users, purchases, …) агенту недоступны.

## История

- 2026-09-02 — создано (feedback GET/PATCH, reports GET/DELETE), ключ в Vercel (Secret, Production).