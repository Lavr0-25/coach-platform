import { createClient } from '@/lib/supabase/server'
import { checkAgentKey } from '@/lib/agentAuth'

// Агентское API: обратная связь (feedback).
// GET   /api/agent/feedback?status=new  — список обращений + счётчики по статусам
// PATCH /api/agent/feedback             — { id, status } сменить статус
// Доступ: заголовок x-agent-key = AGENT_KEY из .env.local (см. lib/agentAuth.ts).
// Предназначено для работы Claude Code с админкой без ручной выгрузки JSON
// (паттерн «agent-admin-api»; в интерфейсе админки дублируется кнопкой выгрузки).

const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'rejected']

// GET — список обращений. Фильтр ?status=new|in_progress|resolved|rejected.
// Каждая запись: текст, автор, статусы, массив ссылок на скриншоты (публичные URL Storage).
export async function GET(request: Request) {
  const denied = checkAgentKey(request)
  if (denied) return denied

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100') || 100, 500)

  let query = supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Счётчики по статусам — чтобы агент сразу видел объём работы
  const [n, p, r, x] = await Promise.all(
    ['new', 'in_progress', 'resolved', 'rejected'].map((s) =>
      supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', s)
    )
  )

  return Response.json({
    total: data?.length ?? 0,
    counts: { new: n.count ?? 0, in_progress: p.count ?? 0, resolved: r.count ?? 0, rejected: x.count ?? 0 },
    items: data ?? [],
  })
}

// PATCH — сменить статус обращения: { id: string, status: 'new'|'in_progress'|'resolved'|'rejected' }
// Это то же действие, что делает админ селектом в /admin/feedback.
export async function PATCH(request: Request) {
  const denied = checkAgentKey(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const id = body?.id as string | undefined
  const status = body?.status as string | undefined

  if (!id || !status) {
    return Response.json({ error: 'Нужны поля id и status' }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(status)) {
    return Response.json(
      { error: `status должен быть одним из: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('feedback')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return Response.json({ error: 'Обращение не найдено' }, { status: 404 })
  }

  return Response.json({ ok: true, id, status })
}