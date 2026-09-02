import { getAgentClient } from '@/lib/agentAuth'

// Агентское API: обратная связь (feedback).
// GET   /api/agent/feedback?status=new  — список обращений + счётчики по статусам
// PATCH /api/agent/feedback             — { id, status } сменить статус
// Доступ: заголовок x-agent-key = ключ со страницы /api-keys (см. lib/agentAuth.ts).
// Роль владельца ключа: админ видит все обращения и может менять статусы;
// остальные видят ТОЛЬКО СВОИ обращения, смена статусов им недоступна.
// Предназначено для работы Claude Code с админкой без ручной выгрузки JSON
// (паттерн «agent-admin-api»; в интерфейсе админки дублируется кнопкой выгрузки).

const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'rejected']

// GET — список обращений. Фильтр ?status=new|in_progress|resolved|rejected.
// Каждая запись: текст, автор, статусы, массив ссылок на скриншоты (публичные URL Storage).
export async function GET(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error
  const supabase = auth.client
  const isAdmin = auth.role === 'admin'

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100') || 100, 500)

  let query = supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)
  // Не-админ: только свои обращения
  if (!isAdmin) query = query.eq('user_id', auth.userId)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Счётчики по статусам — чтобы агент сразу видел объём работы
  // (не-админ считает только по своим)
  const [n, p, r, x] = await Promise.all(
    ['new', 'in_progress', 'resolved', 'rejected'].map((s) => {
      let q = supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', s)
      if (!isAdmin) q = q.eq('user_id', auth.userId)
      return q
    })
  )

  return Response.json({
    scope: isAdmin ? 'admin: все обращения' : 'owner: только свои обращения',
    total: data?.length ?? 0,
    counts: { new: n.count ?? 0, in_progress: p.count ?? 0, resolved: r.count ?? 0, rejected: x.count ?? 0 },
    items: data ?? [],
  })
}

// PATCH — сменить статус обращения: { id, status: 'new'|'in_progress'|'resolved'|'rejected', reply?: string }
// Только для админских ключей — смена статуса означает «админ взял в работу».
// reply — необязательный ответ пользователю («Решено, спасибо…», «Недостаточно данных: …»).
// Пустой reply ('') стирает предыдущий ответ.
export async function PATCH(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error
  if (auth.role !== 'admin') {
    return Response.json(
      { error: 'Смена статусов доступна только ключу администратора' },
      { status: 403 }
    )
  }
  const supabase = auth.client

  const body = await request.json().catch(() => null)
  const id = body?.id as string | undefined
  const status = body?.status as string | undefined
  const reply = body?.reply as string | undefined

  if (!id || !status) {
    return Response.json({ error: 'Нужны поля id и status' }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(status)) {
    return Response.json(
      { error: `status должен быть одним из: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (reply !== undefined) {
    payload.admin_reply = reply || null
    payload.replied_at = reply ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('feedback')
    .update(payload)
    .eq('id', id)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return Response.json({ error: 'Обращение не найдено' }, { status: 404 })
  }

  return Response.json({ ok: true, id, status, reply: reply ? reply : null })
}