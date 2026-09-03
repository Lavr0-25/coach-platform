import { getAgentClient } from '@/lib/agentAuth'

// Агентское API: план тем (lesson_topics) — вход в «ИИ-завод контента».
// GET   /api/agent/topics[?status=queued] — список тем автора + сводка по статусам
// POST  /api/agent/topics                — добавить тему (агент сам предложил): { title?, notes? }
// PATCH /api/agent/topics                — обновить тему: { id, title?, notes?, status?, lesson_id? }
//
// Доступ: заголовок x-agent-key (lib/agentAuth.ts). Клиент работает под сессией
// владельца ключа, RLS-политики lesson_topics_*_own не дают увидеть/изменить чужое.
// Жизненный цикл темы: queued → in_progress → published (или skipped).

const VALID_STATUSES = ['queued', 'in_progress', 'published', 'skipped']

export async function GET(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  if (status && !VALID_STATUSES.includes(status)) {
    return Response.json({ error: `status должен быть одним из: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  let query = auth.client
    .from('lesson_topics')
    .select('id, title, notes, status, lesson_id, suggested_by, created_at, updated_at')
    .order('created_at', { ascending: true })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const topics = data ?? []
  return Response.json({
    total: topics.length,
    counts: {
      queued: topics.filter((t) => t.status === 'queued').length,
      in_progress: topics.filter((t) => t.status === 'in_progress').length,
      published: topics.filter((t) => t.status === 'published').length,
      skipped: topics.filter((t) => t.status === 'skipped').length,
    },
    // Подсказка агенту: какая тема следующая в очереди
    next_queued: topics.find((t) => t.status === 'queued') ?? null,
    items: topics,
  })
}

export async function POST(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  // coach_id берём только с сервера — по владельцу ключа, не из тела запроса
  const { data: coach } = await auth.client
    .from('coaches')
    .select('id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!coach) return Response.json({ error: 'Профиль автора не найден' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const title = (body?.title as string | undefined)?.trim() || null
  const notes = (body?.notes as string | undefined)?.trim() || null
  if (!title && !notes) {
    return Response.json({ error: 'Нужны title или notes — совсем пустую тему добавить нельзя' }, { status: 400 })
  }
  if (title && title.length > 300) {
    return Response.json({ error: 'title слишком длинный (максимум 300 символов)' }, { status: 400 })
  }

  const { data, error } = await auth.client
    .from('lesson_topics')
    .insert({
      coach_id: coach.id,
      title,
      notes,
      status: 'queued',
      suggested_by: 'agent', // через API темы добавляет агент (свои — из кабинета)
    })
    .select('id, title, notes, status, suggested_by, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, topic: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  const id = body?.id as string | undefined
  if (!id) return Response.json({ error: 'Нужно поле id' }, { status: 400 })

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body?.title !== undefined) {
    const title = (body.title as string)?.trim() || null
    if (title && title.length > 300) {
      return Response.json({ error: 'title слишком длинный (максимум 300 символов)' }, { status: 400 })
    }
    payload.title = title
  }
  if (body?.notes !== undefined) payload.notes = (body.notes as string)?.trim() || null
  if (body?.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return Response.json({ error: `status должен быть одним из: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }
    payload.status = body.status
  }
  if (body?.lesson_id !== undefined) payload.lesson_id = body.lesson_id || null

  const { data, error } = await auth.client
    .from('lesson_topics')
    .update(payload)
    .eq('id', id) // RLS: чужая тема не обновится (0 строк)
    .select('id, title, status, lesson_id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Тема не найдена' }, { status: 404 })
  return Response.json({ ok: true, topic: data })
}