import { getAgentClient } from '@/lib/agentAuth'

// Агентское API: жалобы (reports — на комментарии, review_reports — на отзывы).
// GET    /api/agent/reports          — обе таблицы + имена участников + сводка «кто на кого»
// DELETE /api/agent/reports?table=comment|review&id=...  — закрыть жалобу (то же, что кнопка в /admin/reports)
// У жалоб нет статусов: жизненный цикл — «посмотрели → закрыли или забанили».
// Блокировка пользователя через это API НЕ делается (ступень 2, см. методику модерации).
// Жалобы — зона модерации: доступны только ключу администратора.

async function requireAdminAuth(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth
  if (auth.role !== 'admin') {
    return {
      error: Response.json(
        { error: 'Жалобы доступны только ключу администратора' },
        { status: 403 }
      ),
    }
  }
  return auth
}

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request)
  if ('error' in auth) return auth.error
  const supabase = auth.client

  const [{ data: commentData }, { data: reviewData }] = await Promise.all([
    supabase.from('reports').select('*').order('created_at', { ascending: false }),
    supabase.from('review_reports').select('*').order('created_at', { ascending: false }),
  ])

  // Имена участников: в жалобах только user_id — раскрываем через coaches,
  // как это делает интерфейс /admin/reports
  const userIds = new Set<string>()
  ;(commentData || []).forEach((r: any) => { userIds.add(r.reporter_id); userIds.add(r.reported_user_id) })
  ;(reviewData || []).forEach((r: any) => { userIds.add(r.reporter_id); userIds.add(r.reported_user_id) })

  const namesMap = new Map<string, string>()
  if (userIds.size > 0) {
    const { data: usersData } = await supabase
      .from('coaches')
      .select('user_id, display_name')
      .in('user_id', Array.from(userIds))
    usersData?.forEach((u: any) => namesMap.set(u.user_id, u.display_name || u.user_id.substring(0, 8)))
  }

  const withNames = (rows: any[]) => (rows || []).map((r: any) => ({
    ...r,
    reporter_name: namesMap.get(r.reporter_id) || null,
    reported_name: namesMap.get(r.reported_user_id) || null,
  }))

  const commentReports = withNames(commentData || [])
  const reviewReports = withNames(reviewData || [])

  // Сводка: на кого больше всего жалоб (для быстрого «есть ли проблема»)
  const tally = new Map<string, { name: string | null; count: number }>()
  const bump = (userId: string, name: string | null) => {
    const cur = tally.get(userId) || { name, count: 0 }
    cur.count += 1
    if (name) cur.name = name
    tally.set(userId, cur)
  }
  commentReports.forEach((r) => bump(r.reported_user_id, r.reported_name))
  reviewReports.forEach((r) => bump(r.reported_user_id, r.reported_name))

  return Response.json({
    summary: {
      comment_reports: commentReports.length,
      review_reports: reviewReports.length,
      total: commentReports.length + reviewReports.length,
      by_reported_user: Array.from(tally.entries())
        .map(([user_id, v]) => ({ user_id, name: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count),
    },
    comment_reports: commentReports,
    review_reports: reviewReports,
  })
}

// DELETE — закрыть (удалить) жалобу: ?table=comment|review&id=<uuid>
// Это то же действие, что кнопка «Удалить» в /admin/reports.
// ВАЖНО: закрытие жалобы ≠ бан. Блокировки агенту недоступны (ступень 2 методики).
export async function DELETE(request: Request) {
  const auth = await requireAdminAuth(request)
  if ('error' in auth) return auth.error
  const supabase = auth.client

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')

  if (!id || (table !== 'comment' && table !== 'review')) {
    return Response.json(
      { error: 'Нужны параметры: table=comment|review и id' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from(table === 'comment' ? 'reports' : 'review_reports')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return Response.json({ error: 'Жалоба не найдена' }, { status: 404 })
  }

  return Response.json({ ok: true, id })
}