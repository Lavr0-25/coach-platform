import { getAgentClient } from '@/lib/agentAuth'

// GET /api/agent/settings — настройки автора для ИИ-агента (чтение по ключу).
// Пока одна настройка: publish_time — «публиковать уроки в HH:MM»
// (coaches.ai_publish_time, миграция 2026-09-04-agent-publish-time.sql).
// null = автор не задал — агент решает сам (например, публикует сразу).
// Изменение — только в кабинете (/dashboard/ai), агенту менять не даём.

export async function GET(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const { data: coach } = await auth.client
    .from('coaches')
    .select('ai_publish_time')
    .eq('user_id', auth.userId)
    .maybeSingle()

  return Response.json({
    publish_time: coach?.ai_publish_time ?? null,
  })
}