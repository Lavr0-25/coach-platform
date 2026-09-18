import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BarChart3, BookOpen, FileText, Handshake, Layers, Link2,
  MousePointerClick, Share2, ShoppingCart, Target, Users, Wallet, Eye,
} from 'lucide-react'

// Общая аналитика площадки (2026-09-18) — аналог /mentor/analytics, но по
// всем авторам и материалам: обзор (деньги + трафик), материалы, «Поделиться»,
// продажи. Серверный компонент: RLS не даёт админу-пользователю читать чужие
// события аналитики, данные — сервисным клиентом (lib/supabase/admin); доступ
// отрезает app/admin/layout.tsx, роль проверяем и здесь, как на всех страницах
// админки. Период — ?p=7|30|90, вкладка — ?tab=.

interface EvRow {
  event_type: string
  target_type: string
  target_id: string
  created_at: string
  metadata: Record<string, unknown> | null
}

const PERIODS = [7, 30, 90] as const
const DOW_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`
const num = (n: number) => n.toLocaleString('ru-RU')
const pct1 = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const dayIso = (t: number) => new Date(t).toISOString().slice(0, 10)

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coach?.role !== 'admin') redirect('/')

  const { p, tab: tabParam } = await searchParams
  const period = PERIODS.includes(Number(p) as 7 | 30 | 90) ? Number(p) : 30
  const tab = ['overview', 'materials', 'share', 'sales'].includes(tabParam || '') ? tabParam! : 'overview'

  const admin = createAdminClient()
  if (!admin) {
    return (
      <main className="min-h-screen bg-gray-50 py-6 md:py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <BackLink />
          <p className="text-red-600">Сервисный ключ недоступен — статистика не может быть загружена.</p>
        </div>
      </main>
    )
  }

  const now = Date.now()
  const periodStart = now - period * 86400000
  const prevStart = periodStart - period * 86400000
  const since180 = new Date(now - 180 * 86400000)
  const oneMonthAgo = now - 30 * 86400000
  const oneDayAgo = now - 86400000

  // ── События аналитики за 180 дней (страницами по 1000)
  const events: EvRow[] = []
  {
    let from = 0
    for (let page = 0; page < 100; page++) {
      const { data } = await admin
        .from('analytics_events')
        .select('event_type, target_type, target_id, created_at, metadata')
        .in('event_type', ['lesson_view', 'share', 'catalog_impression', 'catalog_click', 'profile_view', 'referral_visit'])
        .gte('created_at', since180.toISOString())
        .order('created_at', { ascending: false })
        .range(from, from + 999)
      const rows = (data || []) as unknown as EvRow[]
      events.push(...rows)
      if (rows.length < 1000) break
      from += 1000
    }
  }
  const metaSrc = (r: EvRow) => (r.metadata && typeof r.metadata === 'object' ? String((r.metadata as Record<string, unknown>).source ?? '') : '')
  const metaKind = (r: EvRow) => (r.metadata && typeof r.metadata === 'object' ? String((r.metadata as Record<string, unknown>).kind ?? '') : '')
  const tsOf = (r: EvRow) => new Date(r.created_at).getTime()

  // ── Материалы и авторы
  const [{ data: lessons }, { data: courses }, { data: coaches }] = await Promise.all([
    admin.from('lessons').select('id, title, price, created_at, coach_id').order('created_at', { ascending: false }),
    admin.from('courses').select('id, title, price, created_at, coach_id'),
    admin.from('coaches').select('id, user_id, display_name'),
  ])
  const authorByCoachId = new Map((coaches || []).map(c => [c.id, c.display_name || 'Автор']))
  const authorByUserId = new Map((coaches || []).map(c => [c.user_id, c.display_name || 'Автор']))

  // ── Реакции (SQL-функция, т.к. RLS favorites не отдаёт чужие строки)
  const lessonIds = (lessons || []).map(l => l.id)
  const social = new Map<string, { likes: number; favorites: number }>()
  if (lessonIds.length > 0) {
    const { data: socialData } = await admin.rpc('get_lesson_social_counts', { p_lesson_ids: lessonIds })
    for (const row of socialData || []) social.set(row.lesson_id, { likes: row.likes || 0, favorites: row.favorites || 0 })
  }

  // ── Прогресс учеников: «Открытия» (всего / месяц / день) как у автора
  const { data: progress } = await admin.from('lesson_progress').select('lesson_id, created_at')
  const { data: courseLinks } = await admin.from('course_lessons').select('course_id, lesson_id')
  const lessonsOfCourse = new Map<string, string[]>()
  for (const cl of courseLinks || []) {
    const arr = lessonsOfCourse.get(cl.course_id) || []
    arr.push(cl.lesson_id)
    lessonsOfCourse.set(cl.course_id, arr)
  }
  const progTotal = new Map<string, number>()
  const progMonth = new Map<string, number>()
  const progDay = new Map<string, number>()
  for (const pr of progress || []) {
    const t = new Date(pr.created_at).getTime()
    progTotal.set(pr.lesson_id, (progTotal.get(pr.lesson_id) || 0) + 1)
    if (t >= oneMonthAgo) progMonth.set(pr.lesson_id, (progMonth.get(pr.lesson_id) || 0) + 1)
    if (t >= oneDayAgo) progDay.set(pr.lesson_id, (progDay.get(pr.lesson_id) || 0) + 1)
  }

  // ── Просмотры страниц (lesson_view, включая гостей) и каталог
  const views = events.filter(e => e.event_type === 'lesson_view')
  const viewsPeriod = views.filter(e => tsOf(e) >= periodStart)
  const viewsPrev = views.filter(e => tsOf(e) >= prevStart && tsOf(e) < periodStart)
  const viewsByDay = new Map<string, number>()
  for (const e of viewsPeriod) viewsByDay.set(dayIso(tsOf(e)), (viewsByDay.get(dayIso(tsOf(e))) || 0) + 1)
  const salesByDay = new Map<string, number>() // заполняется после покупок
  const reach30 = new Map<string, number>()
  const catalog = new Map<string, { impressions: number; clicks: number }>()
  const viewsByKey = new Map<string, number>()
  const viewsBySource = new Map<string, number>()
  const viewsByDow = Array(7).fill(0) as number[]
  for (const e of events) {
    if (e.event_type === 'lesson_view') {
      const k = `${e.target_type}:${e.target_id}`
      viewsByKey.set(k, (viewsByKey.get(k) || 0) + 1)
      const src = metaSrc(e) || 'direct'
      viewsBySource.set(src, (viewsBySource.get(src) || 0) + 1)
      viewsByDow[(new Date(tsOf(e)).getDay() + 6) % 7]++
      if (tsOf(e) >= oneMonthAgo) reach30.set(k, (reach30.get(k) || 0) + 1)
    } else if ((e.event_type === 'catalog_impression' || e.event_type === 'catalog_click') && tsOf(e) >= oneMonthAgo) {
      const k = `${e.target_type}:${e.target_id}`
      const cur = catalog.get(k) || { impressions: 0, clicks: 0 }
      if (e.event_type === 'catalog_impression') cur.impressions++
      else cur.clicks++
      catalog.set(k, cur)
    }
  }

  // ── «Поделиться»: шары и переходы
  const shareEvents = events.filter(e => e.event_type === 'share')
  const visitEvents = events.filter(e => {
    if (e.event_type === 'referral_visit') return true
    if ((e.event_type === 'lesson_view' || e.event_type === 'course_view' || e.event_type === 'profile_view') && metaSrc(e) === 'share') return true
    return false
  })
  const sharesPeriod = shareEvents.filter(e => tsOf(e) >= periodStart).length
  const visitsPeriod = visitEvents.filter(e => tsOf(e) >= periodStart).length
  const sharesByMaterial = new Map<string, number>()
  for (const e of shareEvents) {
    if (e.target_type !== 'lesson' && e.target_type !== 'course') continue
    const k = `${e.target_type}:${e.target_id}`
    sharesByMaterial.set(k, (sharesByMaterial.get(k) || 0) + 1)
  }
  const shareVisitsByMaterial = new Map<string, number>()
  for (const e of visitEvents) {
    if (e.event_type !== 'lesson_view' && e.event_type !== 'course_view') continue
    const k = `${e.target_type}:${e.target_id}`
    shareVisitsByMaterial.set(k, (shareVisitsByMaterial.get(k) || 0) + 1)
  }
  const materialsWithVisits = new Set(visitEvents.filter(e => e.event_type !== 'referral_visit').map(e => `${e.target_type}:${e.target_id}`)).size

  // По типам «Поделиться»
  const lessonShares = shareEvents.filter(e => e.target_type === 'lesson').length
  const courseShares = shareEvents.filter(e => e.target_type === 'course').length
  const profileShares = shareEvents.filter(e => e.target_type === 'profile' && metaKind(e) !== 'referral').length
  const referralShares = shareEvents.filter(e => e.target_type === 'profile' && metaKind(e) === 'referral').length
  const lessonShareVisits = visitEvents.filter(e => e.event_type === 'lesson_view' && metaSrc(e) === 'share').length
  const courseShareVisits = visitEvents.filter(e => e.event_type === 'course_view' && metaSrc(e) === 'share').length
  const profileShareVisits = visitEvents.filter(e => e.event_type === 'profile_view' && metaSrc(e) === 'share').length
  const referralVisits = visitEvents.filter(e => e.event_type === 'referral_visit').length
  const { data: referralRegs } = await admin
    .from('referral_registrations')
    .select('created_at')
    .gte('created_at', since180.toISOString())
  const registrationsInPeriod = (referralRegs || []).filter(r => new Date(r.created_at).getTime() >= periodStart).length

  // Динамика «Поделиться» по дням
  const shareDays: Array<{ iso: string; label: string; shares: number; visits: number }> = []
  {
    const sByDay = new Map<string, number>()
    for (const e of shareEvents) sByDay.set(dayIso(tsOf(e)), (sByDay.get(dayIso(tsOf(e))) || 0) + 1)
    const vByDay = new Map<string, number>()
    for (const e of visitEvents) vByDay.set(dayIso(tsOf(e)), (vByDay.get(dayIso(tsOf(e))) || 0) + 1)
    for (let i = period - 1; i >= 0; i--) {
      const t = now - i * 86400000
      const iso = dayIso(t)
      shareDays.push({
        iso,
        label: new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        shares: sByDay.get(iso) || 0,
        visits: vByDay.get(iso) || 0,
      })
    }
  }
  const shareDayMax = Math.max(1, ...shareDays.map(d => Math.max(d.shares, d.visits)))

  // Топ материалов «Поделиться»
  const shareTop = new Map<string, { type: 'lesson' | 'course' | 'profile'; id: string; shares: number; visits: number }>()
  for (const e of shareEvents) {
    const k = e.target_type === 'profile' ? 'profile' : `${e.target_type}:${e.target_id}`
    const type = e.target_type === 'lesson' ? 'lesson' : e.target_type === 'course' ? 'course' : 'profile'
    const cur = shareTop.get(k) || { type, id: e.target_id, shares: 0, visits: 0 }
    cur.shares++
    shareTop.set(k, cur)
  }
  for (const e of visitEvents) {
    if (e.event_type === 'referral_visit') continue
    const k = e.target_type === 'profile' ? 'profile' : `${e.target_type}:${e.target_id}`
    const cur = shareTop.get(k)
    if (cur) cur.visits++
  }
  const shareTopList = [...shareTop.values()].filter(s => s.shares > 0 || s.visits > 0).sort((a, b) => (b.shares + b.visits) - (a.shares + a.visits)).slice(0, 10)

  // ── Продажи: покупки + платные подписки (только completed — «оплата дошла»)
  const [{ data: purchases }, { data: subPayments }] = await Promise.all([
    admin.from('purchases').select('id, lesson_id, course_id, amount, coach_earnings, payment_status, user_id, purchased_at'),
    admin.from('subscription_payments').select('id, amount, coach_earnings, status, period_months, user_id, coach_user_id, paid_at, created_at'),
  ])
  const { data: buyers } = await admin.from('profiles').select('id, full_name')
  const buyerName = new Map((buyers || []).map(b => [b.id, b.full_name || 'Ученик']))
  const lessonTitle = new Map((lessons || []).map(l => [l.id, l.title]))
  const courseTitle = new Map((courses || []).map(c => [c.id, c.title]))
  const coachIdByLesson = new Map((lessons || []).map(l => [l.id, l.coach_id as string]))
  const coachIdByCourse = new Map((courses || []).map(c => [c.id, c.coach_id as string]))

  const completed = (purchases || []).filter(x => x.payment_status === 'completed')
  const completedSubs = (subPayments || []).filter(s => s.status === 'completed')
  const tsPurchase = (x: any) => new Date(x.purchased_at).getTime()
  const tsSub = (x: any) => new Date(x.paid_at || x.created_at).getTime()

  const sumRow = (x: any) => {
    const amount = Number(x.amount || 0)
    const earn = Number(x.coach_earnings ?? amount)
    return { amount, earn, fee: amount - earn }
  }
  const inPeriod = (t: number) => t >= periodStart
  const purchasesPeriod = completed.filter(x => inPeriod(tsPurchase(x)))
  const subsPeriod = completedSubs.filter(x => inPeriod(tsSub(x)))
  const salesCur = purchasesPeriod.length + subsPeriod.length
  const salesPrev = completed.filter(x => { const t = tsPurchase(x); return t >= prevStart && t < periodStart }).length
    + completedSubs.filter(x => { const t = tsSub(x); return t >= prevStart && t < periodStart }).length
  const periodRows = [...purchasesPeriod, ...subsPeriod].map(sumRow)
  const grossCur = periodRows.reduce((s, m) => s + m.amount, 0)
  const earnCur = periodRows.reduce((s, m) => s + m.earn, 0)
  const feeCur = grossCur - earnCur
  const allRows = [...completed.map(x => ({ x, ts: tsPurchase(x) })), ...completedSubs.map(x => ({ x, ts: tsSub(x) }))]
  const allMoney = allRows.map(r => sumRow(r.x))
  const allTimeEarn = allMoney.reduce((s, m) => s + m.earn, 0)
  const allTimeGross = allMoney.reduce((s, m) => s + m.amount, 0)

  // Продажи по дням (для графика Обзора)
  for (const r of allRows) {
    if (r.ts >= periodStart) salesByDay.set(dayIso(r.ts), (salesByDay.get(dayIso(r.ts)) || 0) + 1)
  }

  // Покупки по материалам (для таблицы «Материалы»)
  const soldByLesson = new Map<string, number>()
  const soldByCourse = new Map<string, number>()
  const grossByMaterial = new Map<string, number>()
  for (const x of completed) {
    const r = sumRow(x)
    if (x.lesson_id) {
      soldByLesson.set(x.lesson_id, (soldByLesson.get(x.lesson_id) || 0) + 1)
      grossByMaterial.set(`lesson:${x.lesson_id}`, (grossByMaterial.get(`lesson:${x.lesson_id}`) || 0) + r.amount)
    }
    if (x.course_id) {
      soldByCourse.set(x.course_id, (soldByCourse.get(x.course_id) || 0) + 1)
      grossByMaterial.set(`course:${x.course_id}`, (grossByMaterial.get(`course:${x.course_id}`) || 0) + r.amount)
    }
  }

  // Последние продажи (таблица «Продажи»)
  const salesRows = [
    ...completed.map(x => ({
      ts: tsPurchase(x), buyer: buyerName.get(x.user_id) || 'Ученик',
      title: lessonTitle.get(x.lesson_id || '') || courseTitle.get(x.course_id || '') || 'Материал',
      author: authorByCoachId.get(coachIdByLesson.get(x.lesson_id || '') || coachIdByCourse.get(x.course_id || '') || '') || 'Автор',
      amount: Number(x.amount || 0), earn: Number(x.coach_earnings ?? x.amount ?? 0), sub: false,
    })),
    ...completedSubs.map(x => ({
      ts: tsSub(x), buyer: buyerName.get(x.user_id) || 'Ученик',
      title: `Подписка на автора · ${x.period_months} мес.`,
      author: authorByUserId.get(x.coach_user_id) || 'Автор',
      amount: Number(x.amount || 0), earn: Number(x.coach_earnings ?? x.amount ?? 0), sub: true,
    })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 15)

  // ── Сборка списка материалов (как у автора: уроки + курсы)
  type MatRow = {
    key: string; type: 'lesson' | 'course'; id: string; title: string; author: string;
    created_at: string; price: number; reach30: number; impressions: number; ctr: number | null;
    total: number; month: number; day: number; shares: number; shareVisits: number;
    likes: number; favorites: number; sold: number; gross: number;
  }
  const materials: MatRow[] = [
    ...(lessons || []).map(l => {
      const k = `lesson:${l.id}`
      const c = catalog.get(k)
      return {
        key: k, type: 'lesson' as const, id: l.id, title: l.title,
        author: authorByCoachId.get(l.coach_id as string) || 'Автор',
        created_at: l.created_at, price: Number(l.price || 0),
        reach30: reach30.get(k) || 0, impressions: c?.impressions || 0,
        ctr: c && c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null,
        total: progTotal.get(l.id) || 0, month: progMonth.get(l.id) || 0, day: progDay.get(l.id) || 0,
        shares: sharesByMaterial.get(k) || 0, shareVisits: shareVisitsByMaterial.get(k) || 0,
        likes: social.get(l.id)?.likes || 0, favorites: social.get(l.id)?.favorites || 0,
        sold: soldByLesson.get(l.id) || 0, gross: grossByMaterial.get(k) || 0,
      }
    }),
    ...(courses || []).map(c => {
      const k = `course:${c.id}`
      const cat = catalog.get(k)
      const lIds = lessonsOfCourse.get(c.id) || []
      return {
        key: k, type: 'course' as const, id: c.id, title: c.title,
        author: authorByCoachId.get(c.coach_id as string) || 'Автор',
        created_at: c.created_at, price: Number(c.price || 0),
        reach30: reach30.get(k) || 0, impressions: cat?.impressions || 0,
        ctr: cat && cat.impressions > 0 ? (cat.clicks / cat.impressions) * 100 : null,
        total: lIds.reduce((s, id) => s + (progTotal.get(id) || 0), 0),
        month: lIds.reduce((s, id) => s + (progMonth.get(id) || 0), 0),
        day: lIds.reduce((s, id) => s + (progDay.get(id) || 0), 0),
        shares: sharesByMaterial.get(k) || 0, shareVisits: shareVisitsByMaterial.get(k) || 0,
        likes: 0, favorites: 0,
        sold: soldByCourse.get(c.id) || 0, gross: grossByMaterial.get(k) || 0,
      }
    }),
  ].sort((a, b) => (b.reach30 - a.reach30) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))

  // ── Обзорные агрегаты
  const viewsCur = viewsPeriod.length
  const convCur = viewsCur > 0 ? (salesCur / viewsCur) * 100 : 0
  const dowMax = Math.max(1, ...viewsByDow)
  const dowBest = viewsByDow.indexOf(dowMax)
  const sourceTotal = [...viewsBySource.values()].reduce((a, b) => a + b, 0)
  const topSources = [...viewsBySource.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 7)

  const topMaterials = [...materials].filter(m => (viewsByKey.get(m.key) || 0) > 0).slice(0, 3)
  const topByViews = (m: MatRow) => viewsByKey.get(m.key) || 0
  const topSourcesOf = (m: MatRow) => {
    const bySrc = new Map<string, number>()
    for (const e of viewsPeriod) {
      if (`${e.target_type}:${e.target_id}` !== m.key) continue
      const src = metaSrc(e) || 'direct'
      bySrc.set(src, (bySrc.get(src) || 0) + 1)
    }
    return [...bySrc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s, n]) => `${srcLabel(s)}: ${n}`)
  }
  const srcLabel = (s: string) => sourceLabels[s] || s
  const sourceLabels: Record<string, string> = {
    share: 'Поделиться', telegram: 'Telegram', dzen: 'Дзен', yandex: 'Яндекс',
    google: 'Поиск Google', vk: 'VK', direct: 'Прямые', other: 'Другое',
  }

  const titleOf = (s: { type: string; id: string }) =>
    s.type === 'lesson' ? (lessonTitle.get(s.id) || 'Урок')
      : s.type === 'course' ? (courseTitle.get(s.id) || 'Курс')
      : (authorByUserId.get(s.id) || 'Автор')
  const typeLabelOf = (t: string) => (t === 'lesson' ? 'Урок' : t === 'course' ? 'Курс' : 'Автор')
  const typeBadgeOf = (t: string) =>
    t === 'lesson' ? 'bg-indigo-100 text-indigo-700' : t === 'course' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'

  // Данные графика Обзора: просмотры (линия) + продажи (столбики)
  const chartDays: Array<{ label: string; views: number; sales: number }> = []
  {
    for (let i = period - 1; i >= 0; i--) {
      const t = now - i * 86400000
      const iso = dayIso(t)
      chartDays.push({
        label: new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        views: viewsByDay.get(iso) || 0,
        sales: salesByDay.get(iso) || 0,
      })
    }
  }
  const chartMax = Math.max(1, ...chartDays.map(d => d.views))

  const fmtTab = (key: string, label: string) => {
    const active = tab === key
    return (
      <Link
        key={key}
        href={`/admin/analytics?tab=${key}&p=${period}`}
        className={`px-5 py-3 text-[15px] font-semibold border-b-2 -mb-0.5 transition-colors whitespace-nowrap ${
          active ? 'text-purple-600 border-purple-600' : 'text-gray-400 border-transparent hover:text-purple-500'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl pb-8">
        <BackLink />

        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0" />
              Аналитика площадки
            </h1>
            <p className="text-gray-600">
              Сводная статистика по всем авторам, материалам и продажам — как аналитика автора, но по всему сайту
            </p>
          </div>
          <div className="flex gap-1 bg-purple-50 rounded-xl p-1 self-start">
            {PERIODS.map(d => (
              <Link
                key={d}
                href={`/admin/analytics?tab=${tab}&p=${d}`}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  period === d ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-purple-600'
                }`}
              >
                {d} дней
              </Link>
            ))}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 border-b-2 border-purple-50 mb-6 overflow-x-auto no-scrollbar">
          {fmtTab('overview', 'Обзор')}
          {fmtTab('materials', 'Материалы')}
          {fmtTab('share', 'Поделиться')}
          {fmtTab('sales', 'Продажи')}
        </div>

        {/* ═════════ ОБЗОР ═════════ */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <AdminKpi icon={<Wallet className="w-7 h-7" />} value={money(grossCur)} title={`Оборот за ${period} дней`} note="Оплаченные покупки и подписки по всей площадке" color="text-purple-600" iconBg="bg-purple-100" />
              <AdminKpi icon={<Handshake className="w-7 h-7" />} value={money(earnCur)} title="На руки авторам" note="Выручка авторов после комиссии платформы" color="text-green-600" iconBg="bg-green-100" />
              <AdminKpi icon={<Layers className="w-7 h-7" />} value={money(feeCur)} title="Комиссия платформы" note={`≈ ${grossCur > 0 ? ((feeCur / grossCur) * 100).toFixed(0) : 0}% от оборота`} color="text-blue-600" iconBg="bg-blue-100" />
              <AdminKpi icon={<ShoppingCart className="w-7 h-7" />} value={String(salesCur)} title="Покупок" note={salesPrev > 0 ? `▲ ${Math.round(((salesCur - salesPrev) / salesPrev) * 100)}% к прошлому периоду` : 'только за текущий период'} color="text-emerald-600" iconBg="bg-emerald-100" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <AdminKpi icon={<Eye className="w-7 h-7" />} value={num(viewsCur)} title="Просмотров (включая гостей)" note={`Прошлый период: ${num(viewsPrev.length)}`} color="text-purple-600" iconBg="bg-purple-100" />
              <AdminKpi icon={<Target className="w-7 h-7" />} value={`${convCur.toFixed(1).replace('.', ',')}%`} title="Конверсия в покупку" note={`${salesCur} ${pluralRu(salesCur, 'продажа', 'продажи', 'продаж')} из ${num(viewsCur)}`} color="text-amber-600" iconBg="bg-amber-100" />
              <AdminKpi icon={<Share2 className="w-7 h-7" />} value={String(sharesPeriod)} title="Поделились" note="Нажатия «Поделиться» на материалах и профилях" color="text-indigo-600" iconBg="bg-indigo-100" />
              <AdminKpi icon={<Link2 className="w-7 h-7" />} value={num(visitsPeriod)} title="Переходов по ссылкам" note={sharesPeriod > 0 ? `≈ ${(visitsPeriod / sharesPeriod).toFixed(1).replace('.', ',')} перехода на одно «Поделиться»` : 'Ждём первых «Поделиться»'} color="text-cyan-600" iconBg="bg-cyan-100" />
            </div>

            <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4 mb-4">
              {/* График просмотры + продажи */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="font-bold text-gray-900">Просмотры и продажи по дням</h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">Открытия страниц материалов (включая гостей) и оплаченные покупки</p>
                <StaticLineBarChart days={chartDays} max={chartMax} />
              </div>

              {/* Источники */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  Откуда приходят читатели
                  <Users className="w-4 h-4 text-gray-400" />
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">Доли источников просмотров за период (метки utm)</p>
                {topSources.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Пока нет просмотров за период</p>
                ) : (
                  <div className="space-y-2.5">
                    {topSources.map(([src, count]) => (
                      <div key={src}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700 font-medium">{srcLabel(src)}</span>
                          <span className="text-gray-500">{Math.round((count / sourceTotal) * 100)}% · {num(count)}</span>
                        </div>
                        <div className="h-2 bg-purple-50 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(count / sourceTotal) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4 mb-4">
              {/* Лучшие материалы */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="font-bold text-gray-900 mb-1">Лучшие материалы за период</h3>
                <p className="text-xs text-gray-500 mb-4">Топ-3 по просмотрам страниц (включая гостей)</p>
                {topMaterials.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Пока нет просмотров за период</p>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-3">
                    {topMaterials.map(m => {
                      const v = topByViews(m)
                      return (
                        <div key={m.key} className="rounded-xl border border-purple-100 p-3.5">
                          <Link href={m.type === 'lesson' ? `/lesson/${m.id}` : `/course/${m.id}`} className="font-semibold text-gray-900 hover:text-purple-600 transition-colors line-clamp-2 text-sm block">
                            {m.title}
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">{m.author}</p>
                          <p className="text-sm text-gray-600 mt-2">Просмотров: <b className="text-purple-600">{num(v)}</b></p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {topSourcesOf(m).map((chip, i) => (
                              <span key={i} className="text-[11px] bg-purple-50 text-purple-700 rounded-full px-2 py-0.5">{chip}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Когда читают */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="font-bold text-gray-900 mb-1">Когда читают</h3>
                <p className="text-xs text-gray-500 mb-4">Просмотры по дням недели за период</p>
                <div className="flex items-end gap-2 h-32">
                  {DOW_LABELS.map((lbl, i) => (
                    <div key={lbl} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${lbl}: ${viewsByDow[i]}`}>
                      <span className={`text-[10px] ${i === viewsByDow.indexOf(dowMax) ? 'text-purple-600 font-bold' : 'text-gray-400'}`}>{viewsByDow[i] || ''}</span>
                      <div
                        className={`w-full max-w-[28px] rounded-t ${i === viewsByDow.indexOf(dowMax) ? 'bg-purple-500' : 'bg-purple-200'}`}
                        style={{ height: `${(viewsByDow[i] / dowMax) * 100}%`, minHeight: viewsByDow[i] > 0 ? 4 : 0 }}
                      />
                      <span className="text-[10px] text-gray-500">{lbl}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Самый читаемый день — <b className="text-gray-700">{DOW_LABELS[viewsByDow.indexOf(dowMax)]}</b></p>
              </div>
            </div>
          </>
        )}

        {/* ═════════ МАТЕРИАЛЫ ═════════ */}
        {tab === 'materials' && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <p className="text-xs text-gray-500 px-5 pt-4">Все материалы всех авторов, отсортированы по охватам за 30 дней. На узких экранах таблицу можно двигать вправо.</p>
            <div className="overflow-x-auto mt-3">
              <div className="min-w-[1360px]">
                <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 px-5 pb-3 bg-purple-50 border-b border-purple-100 text-xs font-semibold text-gray-600">
                  <div className="col-span-3">Материал</div>
                  <div className="text-center">Охваты</div>
                  <div className="text-center">Показы</div>
                  <div className="text-center">CTR</div>
                  <div className="text-center">Всего</div>
                  <div className="text-center">За месяц</div>
                  <div className="text-center">Поделились</div>
                  <div className="text-center">Переходы</div>
                  <div className="text-center">Лайк</div>
                  <div className="text-center">Цена</div>
                  <div className="text-center">Покупок</div>
                  <div className="text-center">Оборот</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {materials.map(m => (
                    <div key={m.key} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 px-5 py-3 items-center hover:bg-purple-50/40 transition-colors">
                      <div className="col-span-3 min-w-0">
                        <Link href={m.type === 'lesson' ? `/lesson/${m.id}` : `/course/${m.id}`} className="font-semibold text-gray-900 hover:text-purple-600 transition-colors block truncate">
                          {m.title}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${m.type === 'course' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {m.type === 'course' ? 'Курс' : 'Урок'}
                          </span>{' '}
                          {m.author} · {new Date(m.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className="text-center font-bold text-gray-800">{num(m.reach30)}</div>
                      <div className="text-center text-gray-600">{num(m.impressions)}</div>
                      <div className={`text-center font-semibold ${m.ctr === null ? 'text-gray-400' : 'text-blue-600'}`}>{m.ctr === null ? '—' : pct1(m.ctr)}</div>
                      <div className="text-center text-gray-600">{num(m.total)}</div>
                      <div className="text-center text-purple-600 font-semibold">{num(m.month)}</div>
                      <div className="text-center text-purple-600 font-semibold">{num(m.shares)}</div>
                      <div className="text-center text-gray-600">{num(m.shareVisits)}</div>
                      <div className="text-center text-red-500 font-semibold">{m.type === 'lesson' ? num(m.likes) : '—'}</div>
                      <div className="text-center text-gray-600">{m.price === 0 ? <span className="text-xs font-semibold text-green-700">Бесплатно</span> : `${m.price} ₽`}</div>
                      <div className={`text-center font-bold ${m.sold > 0 ? 'text-green-600' : 'text-gray-400'}`}>{num(m.sold)}</div>
                      <div className={`text-center font-bold ${m.gross > 0 ? 'text-gray-800' : 'text-gray-400'}`}>{m.gross > 0 ? money(m.gross) : '—'}</div>
                    </div>
                  ))}
                  {materials.length === 0 && (
                    <div className="px-5 py-8 text-center text-gray-500 text-sm">Материалов пока нет</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ ПОДЕЛИТЬСЯ ═════════ */}
        {tab === 'share' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <AdminKpi icon={<Share2 className="w-7 h-7" />} value={String(sharesPeriod)} title={`Поделились за ${period} дней`} note="Нажатия «Поделиться» на уроках, курсах, страницах авторов и партнёрских ссылках" color="text-purple-600" iconBg="bg-purple-100" />
              <AdminKpi icon={<Link2 className="w-7 h-7" />} value={num(visitsPeriod)} title="Переходов по ссылкам" note="Открытия страниц по поделенным ссылкам и партнёрским ссылкам" color="text-blue-600" iconBg="bg-blue-100" />
              <AdminKpi icon={<MousePointerClick className="w-7 h-7" />} value={sharesPeriod > 0 ? `≈ ${(visitsPeriod / sharesPeriod).toFixed(1).replace('.', ',')}` : '—'} title="Переходов на одно «Поделиться»" note="Среднее число переходов с одного нажатия «Поделиться»" color="text-green-600" iconBg="bg-green-100" />
              <AdminKpi icon={<Layers className="w-7 h-7" />} value={String(materialsWithVisits)} title="Материалов с переходами" note="Сколько разных страниц хотя бы раз открыли по поделенным ссылкам" color="text-indigo-600" iconBg="bg-indigo-100" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">По типам</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <AdminKpi icon={<FileText className="w-6 h-6" />} value={String(lessonShares)} title="Уроки" note={`Поделились: ${lessonShares} · Перешли: ${lessonShareVisits}`} color="text-indigo-600" iconBg="bg-indigo-100" />
              <AdminKpi icon={<BookOpen className="w-6 h-6" />} value={String(courseShares)} title="Курсы" note={`Поделились: ${courseShares} · Перешли: ${courseShareVisits}`} color="text-blue-600" iconBg="bg-blue-100" />
              <AdminKpi icon={<Users className="w-6 h-6" />} value={String(profileShares)} title="Страницы авторов" note={`Поделились: ${profileShares} · Перешли: ${profileShareVisits}`} color="text-purple-600" iconBg="bg-purple-100" />
              <AdminKpi icon={<Handshake className="w-6 h-6" />} value={String(referralShares)} title="Партнёрская ссылка" note={`Поделились: ${referralShares} · Перешли: ${referralVisits}`} extra={<div className="mt-3 inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-current"></div>Зарегистрировались: {registrationsInPeriod}</div>} color="text-amber-600" iconBg="bg-amber-100" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">Динамика по дням</h2>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8">
              {sharesPeriod === 0 && visitsPeriod === 0 ? (
                <p className="text-gray-500 text-sm py-6 text-center">За период пока нет ни одного «Поделиться» или перехода — раздел оживёт, как только пользователи начнут делиться.</p>
              ) : (
                <>
                  <div className="flex items-end gap-1 h-40">
                    {shareDays.map(d => (
                      <div key={d.iso} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: поделились ${d.shares}, переходов ${d.visits}`}>
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div className="w-1/2 max-w-[10px] rounded-t bg-purple-500" style={{ height: `${(d.shares / shareDayMax) * 100}%`, minHeight: d.shares > 0 ? 3 : 0 }} />
                          <div className="w-1/2 max-w-[10px] rounded-t bg-blue-400" style={{ height: `${(d.visits / shareDayMax) * 100}%`, minHeight: d.visits > 0 ? 3 : 0 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500"></span>Поделились</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400"></span>Переходы</span>
                  </div>
                </>
              )}
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">Топ материалов</h2>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_120px_120px] gap-4 px-5 py-3 bg-purple-50 text-xs font-medium text-gray-500">
                <div>Материал</div>
                <div className="hidden md:block text-center">Поделились</div>
                <div className="hidden md:block text-center">Переходы</div>
                <div className="hidden md:block text-center">Всего</div>
              </div>
              <div className="divide-y divide-gray-50">
                {shareTopList.map(s => (
                  <div key={`${s.type}-${s.id}`} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_120px_120px] gap-4 px-5 py-3.5 items-center hover:bg-purple-50/40 transition-colors">
                    <div className="min-w-0">
                      <Link href={s.type === 'lesson' ? `/lesson/${s.id}` : s.type === 'course' ? `/course/${s.id}` : `/mentor/${s.id}`} className="font-semibold text-gray-900 hover:text-purple-600 transition-colors block truncate">
                        {titleOf(s)}
                      </Link>
                      <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeBadgeOf(s.type)}`}>{typeLabelOf(s.type)}</span>
                    </div>
                    <div className="hidden md:block text-center font-bold text-purple-600">{s.shares}</div>
                    <div className="hidden md:block text-center font-bold text-blue-600">{s.visits}</div>
                    <div className="hidden md:block text-center font-bold text-gray-700">{s.shares + s.visits}</div>
                    <div className="md:hidden text-right">
                      <div className="font-bold text-gray-700 text-sm">{s.shares + s.visits}</div>
                      <div className="text-[10px] text-gray-400">шар.{s.shares} · пер.{s.visits}</div>
                    </div>
                  </div>
                ))}
                {shareTopList.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">Пока никто не делился материалами</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═════════ ПРОДАЖИ ═════════ */}
        {tab === 'sales' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <AdminKpi icon={<Wallet className="w-7 h-7" />} value={money(grossCur)} title={`Оплачено за ${period} дней`} note="Покупки и платные подписки до комиссии" color="text-purple-600" iconBg="bg-purple-100" />
              <AdminKpi icon={<Handshake className="w-7 h-7" />} value={money(earnCur)} title="На руки авторам" note="Выручка авторов после комиссии (фиксируется в момент покупки)" color="text-green-600" iconBg="bg-green-100" />
              <AdminKpi icon={<Layers className="w-7 h-7" />} value={money(feeCur)} title="Комиссия платформы" note="Разница «оплачено — на руки»" color="text-blue-600" iconBg="bg-blue-100" />
              <AdminKpi icon={<ShoppingCart className="w-7 h-7" />} value={String(salesCur)} title="Покупок" note="В деньгах только доведённые до оплаты" color="text-emerald-600" iconBg="bg-emerald-100" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <AdminKpi icon={<Wallet className="w-7 h-7" />} value={money(allTimeGross)} title="Оборот за всё время" note="Все оплаченные покупки и подписки" color="text-gray-700" iconBg="bg-gray-100" />
              <AdminKpi icon={<Handshake className="w-7 h-7" />} value={money(allTimeEarn)} title="Авторам за всё время" note="Выручка авторов после комиссии" color="text-gray-700" iconBg="bg-gray-100" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">Последние продажи</h2>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[110px_1fr_1fr_1fr_100px_100px] gap-4 px-5 py-3 bg-purple-50 text-xs font-medium text-gray-500">
                <div>Дата</div>
                <div>Покупатель</div>
                <div>Материал</div>
                <div className="hidden md:block">Автор</div>
                <div className="hidden md:block text-right">Оплачено</div>
                <div className="hidden md:block text-right">На руки</div>
              </div>
              <div className="divide-y divide-gray-50">
                {salesRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] md:grid-cols-[110px_1fr_1fr_1fr_100px_100px] gap-4 px-5 py-3.5 items-center hover:bg-purple-50/40 transition-colors">
                    <div className="text-sm text-gray-500">{new Date(r.ts).toLocaleDateString('ru-RU')}</div>
                    <div className="font-medium text-gray-900 truncate">{r.buyer}</div>
                    <div className="text-sm text-gray-700 truncate">
                      {r.title}
                      {r.sub && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">подписка</span>}
                    </div>
                    <div className="hidden md:block text-sm text-gray-500 truncate">{r.author}</div>
                    <div className="hidden md:block text-right font-semibold text-gray-800">{money(r.amount)}</div>
                    <div className="hidden md:block text-right font-semibold text-green-700">{money(r.earn)}</div>
                    <div className="md:hidden text-right text-sm">
                      <div className="font-bold text-gray-800">{money(r.amount)}</div>
                    </div>
                  </div>
                ))}
                {salesRows.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">Покупок пока не было</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

// ========== ХЕЛПЕРЫ / КОМПОНЕНТЫ ==========

function pluralRu(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

function BackLink() {
  return (
    <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-600 transition-colors mb-4">
      <ArrowLeft className="w-4 h-4" />
      В админ-панель
    </Link>
  )
}

function AdminKpi({ icon, value, title, note, extra, color, iconBg }: {
  icon: React.ReactNode
  value: string
  title: string
  note: React.ReactNode
  extra?: React.ReactNode
  color: string
  iconBg: string
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
          <div className="text-sm text-gray-700 font-medium">{title}</div>
          <div className="text-xs text-gray-500 mt-1">{note}</div>
          {extra}
        </div>
        <div className={`${iconBg} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// Статичный график «просмотры (линия) + продажи (столбики)» — без наведения,
// как в админке: значения видны в подписи оси и всплывающих подсказках (title)
function StaticLineBarChart({ days, max }: { days: Array<{ label: string; views: number; sales: number }>; max: number }) {
  const W = 700
  const H = 180
  const n = days.length
  const x = (i: number) => (i * (W - 20)) / Math.max(1, n - 1) + 10
  const line = days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${(H - 24 - (d.views / max) * (H - 40)).toFixed(1)}`).join(' ')
  const barW = Math.max(2, Math.min(8, (W - 20) / Math.max(1, n) * 0.5))
  const tickStep = Math.ceil(n / 7)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Просмотры и продажи по дням">
        {/* сетка */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1="10" x2={W - 10} y1={(H - 24 - f * (H - 40)).toFixed(1)} y2={(H - 24 - f * (H - 40)).toFixed(1)} stroke="#f3f0ff" strokeWidth="1" />
        ))}
        {/* продажи — столбики */}
        {days.map((d, i) => (
          <rect
            key={`b${i}`}
            x={(x(i) - barW / 2).toFixed(1)}
            y={(H - 24 - (d.sales / max) * (H - 40)).toFixed(1)}
            width={barW}
            height={d.sales > 0 ? Math.max(2, (d.sales / max) * (H - 40)) : 0}
            rx="2"
            fill="#10b981"
            opacity="0.85"
          />
        ))}
        {/* просмотры — линия */}
        <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        {days.map((d, i) => (i % tickStep === 0 ? <span key={i}>{d.label}</span> : <span key={i}></span>))}
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-purple-600 inline-block"></span>Просмотры</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span>Покупки</span>
      </div>
    </div>
  )
}