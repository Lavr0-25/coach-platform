// Проверка агентского ключа для /api/agent/*.
// Ключ живёт в .env.local (AGENT_KEY=...), в git не попадает,
// передаётся в заголовке x-agent-key. Отозвать = сгенерировать новый.
// Возвращает Response с ошибкой — или null, если доступ разрешён.
export function checkAgentKey(request: Request): Response | null {
  const expected = process.env.AGENT_KEY
  if (!expected) {
    return Response.json(
      { error: 'AGENT_KEY не настроен на сервере' },
      { status: 503 }
    )
  }

  const provided = request.headers.get('x-agent-key')
  if (!provided || provided !== expected) {
    return Response.json(
      { error: 'Неверный или отсутствующий ключ (заголовок x-agent-key)' },
      { status: 401 }
    )
  }

  return null
}