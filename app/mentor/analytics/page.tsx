'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Inbox } from 'lucide-react'
import { sourceLabel } from '@/lib/utm'

// Деньги в русской записи: 1000 → «1 000 ₽»
function money(n: number) {
  return `${n.toLocaleString('ru-RU')} ₽`
}

// Числовые колонки таблицы «Все материалы», доступные для сортировки
type SortKey = 'reach' | 'totalViews' | 'monthViews' | 'dayViews' | 'likes' | 'favorites' | 'sold' | 'earnings'

// Заголовок сортируемой колонки: клик — по убыванию → по возрастанию → сброс
function SortHeader({ label, sortKey, sort, onSort, className }: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' } | null
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  const arrow = active ? (sort!.dir === 'desc' ? '↓' : '↑') : '↕'
  return (
    <button
      onClick={() => onSort(sortKey)}
      title="Сортировать: клик — от большего к меньшему, ещё клик — от меньшего к большему, третий — сброс"
      className={`inline-flex items-center gap-1 hover:text-purple-700 transition-colors ${active ? 'text-purple-700' : ''} ${className || ''}`}
    >
      {label}
      <span className="text-xs">{arrow}</span>
    </button>
  )
}

// №30: SVG-спарклайн охватов материала (просмотры по дням, 30 дней).
// Без библиотек: линия с заливкой в фирменном градиенте, точки-подсказки —
// нативный <title> при наведении. Все карточки нормализованы к общему max,
// чтобы графики были сравнимы между материалами.
function ReachSparkline({ values, max, gradientId, onHover }: {
  values: number[]
  max: number
  gradientId: string
  onHover?: (idx: number | null) => void
}) {
  const W = 300
  const H = 90
  const PAD = 6
  const n = values.length
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (n - 1)
  const y = (v: number) => H - PAD - (max > 0 ? (v / max) * (H - 2 * PAD) : 0)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none" onMouseLeave={() => onHover?.(null)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* невидимые колонки-подсказки по дням — обновляют строку-подпись */}
      {values.map((v, i) => (
        <rect
          key={i}
          x={x(i) - (W - 2 * PAD) / (2 * (n - 1))}
          y={0}
          width={(W - 2 * PAD) / (n - 1)}
          height={H}
          fill="transparent"
          onMouseEnter={() => onHover?.(i)}
          className="cursor-pointer"
        />
      ))}
    </svg>
  )
}

// Плюрализация: plural(1, 'просмотр', 'просмотра', 'просмотров') → «просмотр»
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// Дата дня графика по индексу (последний индекс = сегодня)
function dayLabel(idx: number, days: number) {
  return new Date(Date.now() - (days - 1 - idx) * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// Карточка материала в «Динамике охватов»: строка-подпись над графиком
// обновляется при наведении на день (у каждой карточки своё состояние)
function ReachCard({ r, max }: {
  r: { id: string; type: 'lesson' | 'course'; title: string; total30: number; series: number[]; sources: Record<string, number> }
  max: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <Card variant="glow" padding="none" className="p-5">
      <Link
        href={`/mentor/analytics/${r.id}`}
        className="block mb-0.5 font-semibold text-gray-900 truncate hover:text-purple-600 transition-colors"
        title={r.title}
      >
        {r.type === 'course' && <span className="text-blue-600 mr-1" title="Курс">📚</span>}
        {r.title}
      </Link>
      <p className="text-xs text-gray-500 mb-2">
        Просмотров за 30 дней: <span className="font-bold text-purple-700">{r.total30}</span>
      </p>
      {/* Подпись под курсором: значение + пояснение */}
      <p className="text-xs text-gray-600 mb-2 min-h-[16px]">
        {hover === null ? (
          <span className="text-gray-400">Наведите на график — цифры за день</span>
        ) : (
          <>
            <b className="text-gray-900">{dayLabel(hover, 30)}</b>
            {' — '}{r.series[hover]} {plural(r.series[hover], 'просмотр', 'просмотра', 'просмотров')} страницы материала, включая гостей
          </>
        )}
      </p>
      <ReachSparkline values={r.series} max={max} gradientId={`reach-${r.id}`} onHover={setHover} />
      {/* Разбивка по источникам перехода */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {Object.entries(r.sources)
          .sort((a, b) => b[1] - a[1])
          .map(([src, count]) => (
            <span
              key={src}
              className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2 py-0.5"
            >
              {sourceLabel(src)}: {count}
            </span>
          ))}
      </div>
    </Card>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [coach, setCoach] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Данные для статистики
  const [stats, setStats] = useState({
    totalLessons: 0,
    totalCourses: 0,
    subscribers: 0,
    totalViews: 0,
    totalCompleted: 0,
    totalLikes: 0,
    totalFavorites: 0,
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [lessonsStats, setLessonsStats] = useState<any[]>([])
  const [coursesStats, setCoursesStats] = useState<any[]>([])
  // Продажи: покупки наших материалов (RLS пускает ментора к своим — миграция
  // docs/migrations/2026-09-15-f7-purchases-stats.sql)
  const [sales, setSales] = useState<any[]>([])
  const [salesTotal, setSalesTotal] = useState(0)
  const [salesRevenue, setSalesRevenue] = useState(0)
  const [salesRevenue30, setSalesRevenue30] = useState(0)
  // №30: динамика охватов — просмотры по дням на материал (из analytics_events,
  // включая гостей; RLS отбирает события только наших уроков)
  const [reach, setReach] = useState<Array<{
    id: string
    type: 'lesson' | 'course'
    title: string
    series: number[]
    total30: number
    sources: Record<string, number>
  }>>([])
  const [reachTotal, setReachTotal] = useState(0)
  // Общий max по всем материалам — чтобы графики были сопоставимы между карточками
  const reachMax = Math.max(1, ...reach.map((r) => Math.max(...r.series)))
  // Управление таблицей «Все материалы»: поиск, фильтр, порционная выдача,
  // сортировка по числовым колонкам
  const [tableSearch, setTableSearch] = useState('')
  const [tableFilter, setTableFilter] = useState<'all' | 'reach' | 'sold' | 'read'>('all')
  const [visibleCount, setVisibleCount] = useState(10)
  const [tableSort, setTableSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
  // День под курсором на графике «Активность» — для строки-подписи
  const [activityHover, setActivityHover] = useState<number | null>(null)

  // Клик по заголовку: без сортировки → по убыванию → по возрастанию → сброс
  const toggleSort = (key: SortKey) => {
    setTableSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' }
      if (prev.dir === 'desc') return { key, dir: 'asc' }
      return null
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Смена поиска/фильтра сбрасывает порцию «Показать ещё»
  useEffect(() => {
    setVisibleCount(10)
  }, [tableSearch, tableFilter])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/login')
        return
      }
      setUser(user)

      const { data: coachData } = await supabase
        .from('coaches')
        .select('id, display_name, user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!coachData) {
        redirect('/dashboard/mentor')
        return
      }
      setCoach(coachData)

      // Получаем все уроки автора
      const { data: allLessons } = await supabase
        .from('lessons')
        .select('id, title, cover_image, price, is_free_preview, created_at')
        .eq('coach_id', coachData.id)
        .order('created_at', { ascending: false })

      const lessonIds = allLessons?.map(l => l.id) || []

      // Лайки и избранное по урокам: SQL-функция (security definer), т.к. RLS favorites
      // не даёт автору читать чужие строки избранного даже на своих уроках
      let socialByLesson = new Map<string, { likes: number; favorites: number }>()
      if (lessonIds.length > 0) {
        const { data: socialData } = await supabase.rpc('get_lesson_social_counts', {
          p_lesson_ids: lessonIds,
        })
        for (const row of socialData || []) {
          socialByLesson.set(row.lesson_id, { likes: row.likes || 0, favorites: row.favorites || 0 })
        }
      }

      // Общая статистика
      const totalLessons = allLessons?.length || 0

      // Курсы автора: список нужен для счётчика, названий в продажах и
      // таблицы «Все материалы» (охваты, цена, продажи)
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, title, cover_image, price, created_at')
        .eq('coach_id', coachData.id)

      const courseIds = allCourses?.map(c => c.id) || []

      // Состав курсов: какие уроки входят в каждый курс — чтобы «Просмотры»
      // курса в таблице считались по lesson_progress его уроков
      const lessonsByCourse = new Map<string, string[]>()
      if (courseIds.length > 0) {
        const { data: courseLinks } = await supabase
          .from('course_lessons')
          .select('course_id, lesson_id')
          .in('course_id', courseIds)
        for (const cl of courseLinks || []) {
          const arr = lessonsByCourse.get(cl.course_id) || []
          arr.push(cl.lesson_id)
          lessonsByCourse.set(cl.course_id, arr)
        }
      }

      // 🔥 Подсчёт уникальных подписчиков через subscriptions
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('coach_id', user.id)

      const uniqueSubscribers = new Set(subsData?.map(s => s.user_id) || [])
      const subscribersCount = uniqueSubscribers.size

      // Статистика просмотров из lesson_progress
      const { data: allProgress } = await supabase
        .from('lesson_progress')
        .select('lesson_id, user_id, status, started_at, completed_at')
        .in('lesson_id', lessonIds)

      // Группировка по дням для графика (последние 30 дней)
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // 💰 Продажи: покупки наших уроков и курсов. В деньгах считаем только
      // completed — pending значит «оплата не дошла» и деньгами не является.
      // «На руки» берём из coach_earnings (комиссия фиксируется в момент покупки).
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('id, lesson_id, course_id, amount, coach_earnings, payment_status, user_id, purchased_at')
        .order('purchased_at', { ascending: false })

      // Платные подписки на автора (Ф3): списания из журнала subscription_payments.
      // RLS сам отбирает только наши (coach_user_id = наш user id).
      const { data: subPaymentsData } = await supabase
        .from('subscription_payments')
        .select('id, amount, coach_earnings, status, period_months, user_id, paid_at, created_at')
        .order('paid_at', { ascending: false })

      const lessonTitle = new Map<string, string>((allLessons || []).map((l: any) => [l.id, l.title]))
      const courseTitle = new Map<string, string>((allCourses || []).map((c: any) => [c.id, c.title]))

      // Имена покупателей — отдельным запросом по профилям (по id из покупок и подписок)
      const buyerIds = [
        ...new Set([
          ...(purchasesData || []).map((p: any) => p.user_id),
          ...(subPaymentsData || []).map((sp: any) => sp.user_id),
        ]),
      ]
      const buyerName = new Map<string, string>()
      if (buyerIds.length > 0) {
        const { data: buyersData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', buyerIds)
        for (const b of buyersData || []) buyerName.set(b.id, b.full_name || 'Ученик')
      }

      const completedPurchases = (purchasesData || []).filter((p: any) => p.payment_status === 'completed')

      // Сколько раз куплен каждый урок/курс и доход с него — для колонок
      // «Покупок» и «На руки» в таблице материалов (доход = coach_earnings)
      const salesByLesson = new Map<string, number>()
      const salesByCourse = new Map<string, number>()
      const earningsByLesson = new Map<string, number>()
      const earningsByCourse = new Map<string, number>()
      for (const p of completedPurchases) {
        const earn = Number(p.coach_earnings ?? p.amount ?? 0)
        if (p.lesson_id) {
          salesByLesson.set(p.lesson_id, (salesByLesson.get(p.lesson_id) || 0) + 1)
          earningsByLesson.set(p.lesson_id, (earningsByLesson.get(p.lesson_id) || 0) + earn)
        }
        if (p.course_id) {
          salesByCourse.set(p.course_id, (salesByCourse.get(p.course_id) || 0) + 1)
          earningsByCourse.set(p.course_id, (earningsByCourse.get(p.course_id) || 0) + earn)
        }
      }

      const salesRows = completedPurchases.map((p: any) => ({
        id: p.id,
        buyer: buyerName.get(p.user_id) || 'Ученик',
        title: lessonTitle.get(p.lesson_id || '') || courseTitle.get(p.course_id || '') || 'Материал',
        amount: Number(p.amount || 0),
        earnings: Number(p.coach_earnings ?? p.amount ?? 0),
        date: p.purchased_at,
      }))

      // Списания подписок добавляем к продажам той же строкой в таблицу
      const subRows = (subPaymentsData || [])
        .filter((sp: any) => sp.status === 'completed')
        .map((sp: any) => ({
          id: `sub-${sp.id}`,
          buyer: buyerName.get(sp.user_id) || 'Ученик',
          title: `Подписка на автора · ${sp.period_months} мес.`,
          amount: Number(sp.amount || 0),
          earnings: Number(sp.coach_earnings ?? sp.amount ?? 0),
          date: sp.paid_at || sp.created_at,
        }))
      salesRows.push(...subRows)

      const allSales = [...completedPurchases, ...subRows]
      const revenueTotal = allSales.reduce(
        (s: number, p: any) => s + Number(p.coach_earnings ?? p.amount ?? 0), 0
      )
      const revenue30 = allSales
        .filter((p: any) => new Date(p.purchased_at || p.date) >= oneMonthAgo)
        .reduce((s: number, p: any) => s + Number(p.coach_earnings ?? p.amount ?? 0), 0)

      const activityByDay: { [key: string]: { views: number; completed: number } } = {}
      allProgress?.forEach(p => {
        const started = new Date(p.started_at)
        if (started >= thirtyDaysAgo) {
          const day = started.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
          if (!activityByDay[day]) {
            activityByDay[day] = { views: 0, completed: 0 }
          }
          activityByDay[day].views++
          if (p.status === 'completed') {
            activityByDay[day].completed++
          }
        }
      })

      // Последние 30 дней для графика
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      }).reverse()

      const chart = last30Days.map(day => ({
        day,
        views: activityByDay[day]?.views || 0,
        completed: activityByDay[day]?.completed || 0,
      }))

      const totalViews = allProgress?.length || 0
      const totalCompleted = allProgress?.filter(p => p.status === 'completed').length || 0

      // №30: охваты — события lesson_view по дням (последние 30 дней) с
      // источником перехода из metadata.source. Гостевые события (user_id
      // IS NULL) RLS тоже отдаёт — политика «Mentors can view own analytics»
      // фильтрует только по уроку. События без metadata (старые) — «Прямая».
      const dayLabels30: string[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        dayLabels30.push(d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }))
      }

      const reachRows: Array<{ id: string; type: 'lesson' | 'course'; title: string; series: number[]; total30: number; sources: Record<string, number> }> = []
      if (lessonIds.length > 0 || courseIds.length > 0) {
        const { data: viewsData } = await supabase
          .from('analytics_events')
          .select('target_id, target_type, created_at, metadata')
          .in('target_id', [...lessonIds, ...courseIds])
          .gte('created_at', thirtyDaysAgo.toISOString())

        // series: индекс 0 = 29 дней назад … 29 = сегодня; ключ — тип:id,
        // т.к. один и тот же uuid в таблицах lesson и course совпадать не может,
        // но читаем события обоих типов одним запросом
        const seriesById = new Map<string, number[]>()
        const sourcesById = new Map<string, Record<string, number>>()
        const keyOf = (type: string, tid: string) => `${type}:${tid}`
        for (const l of allLessons || []) {
          seriesById.set(keyOf('lesson', l.id), new Array(30).fill(0))
          sourcesById.set(keyOf('lesson', l.id), {})
        }
        for (const c of allCourses || []) {
          seriesById.set(keyOf('course', c.id), new Array(30).fill(0))
          sourcesById.set(keyOf('course', c.id), {})
        }
        for (const ev of viewsData || []) {
          const key = keyOf(ev.target_type, ev.target_id)
          const arr = seriesById.get(key)
          if (!arr) continue
          const dayIndex = Math.min(29, Math.max(0, 29 - Math.floor((now.getTime() - new Date(ev.created_at).getTime()) / 86400000)))
          arr[dayIndex]++
          const src = (ev.metadata as any)?.source || 'direct'
          const s = sourcesById.get(key)!
          s[src] = (s[src] || 0) + 1
        }
        for (const l of allLessons || []) {
          const series = seriesById.get(keyOf('lesson', l.id))!
          const total30 = series.reduce((a, b) => a + b, 0)
          reachRows.push({ id: l.id, type: 'lesson', title: l.title, series, total30, sources: sourcesById.get(keyOf('lesson', l.id))! })
        }
        for (const c of allCourses || []) {
          const series = seriesById.get(keyOf('course', c.id))!
          const total30 = series.reduce((a, b) => a + b, 0)
          reachRows.push({ id: c.id, type: 'course', title: c.title, series, total30, sources: sourcesById.get(keyOf('course', c.id))! })
        }
        reachRows.sort((a, b) => b.total30 - a.total30)
        setReachTotal(reachRows.reduce((s, r) => s + r.total30, 0))
      }
      setReach(reachRows)

      // Статистика по каждому уроку
      const lessons = allLessons?.map(lesson => {
        const lessonProgress = allProgress?.filter(p => p.lesson_id === lesson.id) || []
        const totalLessonViews = lessonProgress.length
        const monthViews = lessonProgress.filter(p => new Date(p.started_at) >= oneMonthAgo).length
        const dayViews = lessonProgress.filter(p => new Date(p.started_at) >= oneDayAgo).length
        
        return {
          ...lesson,
          type: 'lesson' as const,
          totalViews: totalLessonViews,
          monthViews,
          dayViews,
          sold: salesByLesson.get(lesson.id) || 0,
          earnings: earningsByLesson.get(lesson.id) || 0,
          social: socialByLesson.get(lesson.id) || { likes: 0, favorites: 0 },
        }
      }) || []

      // Статистика по каждому курсу (для таблицы «Все материалы»): охваты —
      // course_view, просмотры — lesson_progress уроков курса, продажи — покупки
      const courses = allCourses?.map(course => {
        const courseLessonIds = lessonsByCourse.get(course.id) || []
        const courseProgress = allProgress?.filter(p => courseLessonIds.includes(p.lesson_id)) || []

        return {
          ...course,
          type: 'course' as const,
          totalViews: courseProgress.length,
          monthViews: courseProgress.filter(p => new Date(p.started_at) >= oneMonthAgo).length,
          dayViews: courseProgress.filter(p => new Date(p.started_at) >= oneDayAgo).length,
          sold: salesByCourse.get(course.id) || 0,
          earnings: earningsByCourse.get(course.id) || 0,
          social: { likes: 0, favorites: 0 },
        }
      }) || []

      setStats({
        totalLessons,
        totalCourses: allCourses?.length || 0,
        subscribers: subscribersCount,
        totalViews,
        totalCompleted,
        totalLikes: [...socialByLesson.values()].reduce((s, v) => s + v.likes, 0),
        totalFavorites: [...socialByLesson.values()].reduce((s, v) => s + v.favorites, 0),
      })

      setSales(salesRows)
      setSalesTotal(salesRows.length)
      setSalesRevenue(revenueTotal)
      setSalesRevenue30(revenue30)

      setChartData(chart)
      setLessonsStats(lessons)
      setCoursesStats(courses)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  const maxChartValue = Math.max(...chartData.map(d => d.views), 1)
  const gridLines = 5
  const gridStep = Math.ceil(maxChartValue / gridLines)

  // Таблица «Все материалы»: поиск по названию + фильтр по числовым
  // показателям + сортировка + порционная выдача («Показать ещё»)
  const tableMaterials = [...lessonsStats, ...coursesStats].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const filteredMaterials = tableMaterials.filter((m) => {
    if (tableSearch && !m.title.toLowerCase().includes(tableSearch.trim().toLowerCase())) return false
    if (tableFilter === 'reach' && (reach.find(r => r.type === m.type && r.id === m.id)?.total30 ?? 0) === 0) return false
    if (tableFilter === 'sold' && !(m.sold > 0)) return false
    if (tableFilter === 'read' && !(m.totalViews > 0)) return false
    return true
  })
  if (tableSort) {
    const numOf = (m: any): number => {
      switch (tableSort.key) {
        case 'reach': return reach.find(r => r.type === m.type && r.id === m.id)?.total30 ?? 0
        case 'totalViews': return m.totalViews || 0
        case 'monthViews': return m.monthViews || 0
        case 'dayViews': return m.dayViews || 0
        case 'likes': return m.type === 'lesson' ? (m.social.likes || 0) : 0
        case 'favorites': return m.type === 'lesson' ? (m.social.favorites || 0) : 0
        case 'sold': return m.sold || 0
        case 'earnings': return m.earnings || 0
      }
    }
    filteredMaterials.sort((a, b) =>
      tableSort.dir === 'desc' ? numOf(b) - numOf(a) : numOf(a) - numOf(b)
    )
  }
  const shownMaterials = filteredMaterials.slice(0, visibleCount)

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
          Аналитика и статистика
        </h1>
        <p className="text-gray-600">
          Продажи, аудитория и вовлечённость: кто и что покупает, кто смотрит и как реагирует
        </p>
      </div>

      {/* 💰 Продажи */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">₽</span>
          Продажи
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Card variant="glow" padding="none" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
                🛒
              </div>
              <div>
                <div className="text-2xl font-bold gradient-text">{salesTotal}</div>
                <div className="text-sm text-gray-600">Продаж всего</div>
              </div>
            </div>
          </Card>

          <Card variant="glow" padding="none" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">
                💰
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{money(salesRevenue)}</div>
                <div className="text-sm text-gray-600">Всего на руки</div>
              </div>
            </div>
          </Card>

          <Card variant="glow" padding="none" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                📈
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{money(salesRevenue30)}</div>
                <div className="text-sm text-gray-600">На руки за 30 дней</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Таблица продаж */}
        {sales.length > 0 ? (
          <Card variant="glow" padding="none" className="overflow-hidden border border-purple-100">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-purple-50 border-b border-purple-100 text-sm font-semibold text-gray-700">
              <div className="col-span-3">Покупатель</div>
              <div className="col-span-4">Материал</div>
              <div className="col-span-2 text-center">Дата</div>
              <div className="col-span-1 text-center">Оплачено</div>
              <div className="col-span-2 text-center">На руки</div>
            </div>
            <div className="divide-y divide-purple-50">
              {sales.map((s) => (
                <div key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-4 px-6 py-4">
                  <div className="col-span-3 font-semibold text-gray-900">{s.buyer}</div>
                  <div className="col-span-4 text-gray-700 truncate">{s.title}</div>
                  <div className="col-span-2 text-center text-sm text-gray-500">
                    {new Date(s.date).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="col-span-1 text-center font-semibold text-gray-700">
                    {money(s.amount)}
                    <span className="text-xs text-gray-400 md:hidden"> — оплачено</span>
                  </div>
                  <div className="col-span-2 text-center font-bold text-emerald-600">
                    {money(s.earnings)}
                    <span className="text-xs text-gray-400 md:hidden"> — на руки</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 text-center">
            <p className="text-gray-600 mb-1">Пока продаж нет</p>
            <p className="text-sm text-gray-500">
              Как только кто-то купит ваш урок или курс, покупка появится здесь
            </p>
          </div>
        )}
      </div>

      {/* 👥 Аудитория и вовлечённость */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">👥</span>
          Аудитория и вовлечённость
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 🔥 КЛИКАБЕЛЬНАЯ ССЫЛКА НА ОТДЕЛЬНУЮ СТРАНИЦУ (исправлен путь) */}
          <Link
            href="/dashboard/mentor/subscribers"
            className="style-card p-6 hover:shadow-lg transition-colors group block"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl transition-transform">
                👥
              </div>
              <div>
                <div className="text-2xl font-bold gradient-text">{stats.subscribers}</div>
                <div className="text-sm text-gray-600">Подписчиков</div>
              </div>
            </div>
          </Link>

          <Card variant="glow" padding="none" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
                👁️
              </div>
              <div>
                <div className="text-2xl font-bold gradient-text">{stats.totalViews}</div>
                <div className="text-sm text-gray-600">Просмотров</div>
              </div>
            </div>
          </Card>

          {/* Реакции учеников: лайки и избранное по всем урокам */}
          <Card variant="glow" padding="none" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">
                ❤️
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.totalLikes}</div>
                <div className="text-sm text-gray-600">Лайков</div>
              </div>
            </div>
          </Card>

          <Card variant="glow" padding="none" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
                ⭐
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{stats.totalFavorites}</div>
                <div className="text-sm text-gray-600">В избранном</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 📈 №30: Динамика охватов — карточка на материал, как в референсе
          Дарины: график просмотров по дням + разбивка по каналам */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📈</span>
          Динамика охватов
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Просмотры материалов по дням, за 30 дней — включая неавторизованных читателей
        </p>

        {reach.some(r => r.total30 > 0) ? (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Топ-3 самых просматриваемых материалов; клик по названию —
                  на страницу подробной статистики материала */}
              {reach.filter(r => r.total30 > 0).slice(0, 3).map((r) => (
                <ReachCard key={`${r.type}-${r.id}`} r={r} max={reachMax} />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Показаны 3 самых просматриваемых материала. Всего просмотров за 30 дней:{' '}
              <span className="font-semibold text-gray-700">{reachTotal}</span>
              {' '}— остальные материалы в таблице «Все материалы» ниже.
            </p>
          </>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 text-center">
            <p className="text-gray-600 mb-1">Пока нет просмотров за последние 30 дней</p>
            <p className="text-sm text-gray-500">
              Поделитесь ссылкой на материал — подсчёт ведётся с 16.09, включая неавторизованных читателей
            </p>
          </div>
        )}
      </div>

      {/* График активности с сеткой */}
      <Card variant="glow" padding="none" className="p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📊</span>
          Активность за последние 30 дней
        </h2>

        {/* Подпись под курсором: значение + пояснение */}
        <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
          {activityHover === null ? (
            <span className="text-gray-400">Наведите курсор на столбец — покажу цифры за этот день</span>
          ) : (
            <>
              <b className="text-gray-900">{dayLabel(activityHover, 30)}</b>
              {' — '}{chartData[activityHover].views} {plural(chartData[activityHover].views, 'просмотр', 'просмотра', 'просмотров')} уроков учениками (авторизованные читатели),{' '}
              завершили: {chartData[activityHover].completed}
            </>
          )}
        </p>

        {chartData.some(d => d.views > 0) ? (
          <div className="space-y-4">
            {/* Легенда */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                <span className="text-gray-600">Просмотры</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                <span className="text-gray-600">Завершено</span>
              </div>
            </div>

            {/* График с сеткой */}
            <div className="relative">
              {/* Горизонтальные линии сетки */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                {Array.from({ length: gridLines + 1 }, (_, i) => {
                  const value = gridStep * (gridLines - i)
                  const percent = ((gridLines - i) / gridLines) * 100
                  return (
                    <div key={i} className="relative w-full" style={{ height: '0' }}>
                      <div 
                        className="absolute left-0 right-0 border-t border-dashed border-gray-200"
                        style={{ top: `${percent}%` }}
                      ></div>
                      <div 
                        className="absolute left-0 text-xs text-gray-400 -translate-y-1/2"
                        style={{ top: `${percent}%` }}
                      >
                        {value}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Столбцы */}
              <div className="relative flex items-end gap-1 h-64 pl-12 pb-8 overflow-x-auto" onMouseLeave={() => setActivityHover(null)}>
                {chartData.map((data, idx) => {
                  const height = (data.views / (gridStep * gridLines)) * 100
                  const completedHeight = data.views > 0 ? (data.completed / data.views) * height : 0
                  
                  return (
                    <div
                      key={idx}
                      className="flex-1 min-w-[16px] flex flex-col items-center group relative cursor-pointer"
                      onMouseEnter={() => setActivityHover(idx)}
                    >
                      {/* Столбец */}
                      <div className="w-full flex flex-col items-center justify-end h-56">
                        <div 
                          className="w-full bg-gradient-to-t from-purple-500 to-blue-500 rounded-t-sm relative transition-opacity group-hover:opacity-80"
                          style={{ height: `${Math.max(height, data.views > 0 ? 2 : 0)}%` }}
                        >
                          {/* Столбец завершённых */}
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-emerald-500 rounded-t-sm"
                            style={{ height: `${completedHeight}%` }}
                          ></div>
                          
                          {/* Число над столбцом */}
                          {data.views > 0 && (
                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs font-bold text-purple-700">
                              {data.views}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Дата */}
                      <div className="text-[10px] text-gray-500 mt-2 absolute -bottom-6 whitespace-nowrap">
                        {data.day}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Итого */}
            <div className="flex items-center justify-between pt-6 border-t border-purple-100 mt-12">
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{stats.totalViews}</div>
                <div className="text-sm text-gray-600">Всего просмотров</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{stats.totalCompleted}</div>
                <div className="text-sm text-gray-600">Завершено уроков</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">
                  {stats.totalViews > 0 ? Math.round((stats.totalCompleted / stats.totalViews) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Конверсия</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center">
            <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
            <p className="text-gray-600 mb-2">Пока нет данных об активности</p>
            <p className="text-sm text-gray-500">
              Когда подписчики начнут смотреть ваши уроки, здесь появится график
            </p>
          </div>
        )}
      </Card>

      {/* Таблица всех материалов: уроки + курсы, клик по «Охватам» — на страницу
          деталей материала. Поиск + фильтры + «Показать ещё» — на случай,
          когда материалов станет много */}
      {(lessonsStats.length > 0 || coursesStats.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Все материалы</h2>
            <Link href="/dashboard/mentor/lessons" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
              Управление материалами →
            </Link>
          </div>

          {/* Поиск и фильтры */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Поиск по названию материала…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-purple-100 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'Все' },
                { key: 'reach', label: 'С охватами' },
                { key: 'read', label: 'Читали' },
                { key: 'sold', label: 'С продажами' },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTableFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    tableFilter === f.key
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-purple-100 hover:border-purple-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Card variant="glow" padding="none" className="overflow-hidden border border-purple-100">
            {/* Заголовок таблицы (скрыт на мобильных). Числовые колонки
                сортируются кликом: ↓ → ↑ → сброс */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-purple-50 border-b border-purple-100 text-sm font-semibold text-gray-700">
              <div className="col-span-3">Материал</div>
              <div className="col-span-1 text-center">
                <SortHeader label="Охваты" sortKey="reach" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">
                <SortHeader label="Всего" sortKey="totalViews" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">
                <SortHeader label="За месяц" sortKey="monthViews" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">
                <SortHeader label="За день" sortKey="dayViews" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">
                <SortHeader label="Лайк" sortKey="likes" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">
                <SortHeader label="В избранном" sortKey="favorites" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">Цена</div>
              <div className="col-span-1 text-center">
                <SortHeader label="Покупок" sortKey="sold" sort={tableSort} onSort={toggleSort} />
              </div>
              <div className="col-span-1 text-center">
                <SortHeader label="На руки" sortKey="earnings" sort={tableSort} onSort={toggleSort} />
              </div>
            </div>

            {/* Строки таблицы: порция от отфильтрованного списка */}
            <div className="divide-y divide-purple-50">
              {shownMaterials.map((mat) => {
                  const isCourse = mat.type === 'course'
                  const editHref = isCourse
                    ? `/dashboard/mentor/courses/${mat.id}/edit`
                    : `/dashboard/mentor/lessons/${mat.id}/edit`
                  const reach30 = reach.find(r => r.type === mat.type && r.id === mat.id)?.total30

                  return (
                    <div
                      key={`${mat.type}-${mat.id}`}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-purple-50/50 transition-colors group"
                    >
                      {/* Материал (картинка + название + тип) */}
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
                          {(mat.cover_image || mat.cover_image_url) ? (
                            <Image
                              src={mat.cover_image || mat.cover_image_url}
                              alt={mat.title}
                              fill
                              sizes="64px"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-white text-lg opacity-50">{isCourse ? '📚' : '📝'}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={editHref}
                            className="font-semibold text-gray-900 hover:text-purple-600 transition-colors truncate block"
                            title={mat.title}
                          >
                            {mat.title}
                          </Link>
                          <p className="text-xs text-gray-500">
                            <span className={isCourse ? 'text-blue-600 font-medium' : ''}>
                              {isCourse ? 'Курс' : 'Урок'}
                            </span>
                            {' · '}
                            {new Date(mat.created_at).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                      </div>

                      {/* Охваты: просмотры за 30 дней (включая гостей) — клик открывает
                          подробную статистику материала за выбранный период */}
                      <div className="col-span-1 flex items-center justify-center">
                        <Link
                          href={`/mentor/analytics/${mat.id}`}
                          className="text-center px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
                          title="Подробная статистика материала"
                        >
                          <div className="text-lg font-bold gradient-text">{reach30 ?? 0}</div>
                          <div className="text-[10px] text-gray-500">подробнее</div>
                        </Link>
                      </div>

                      {/* Всего просмотров (ученики, lesson_progress) */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold gradient-text">{mat.totalViews}</div>
                          <div className="text-xs text-gray-500 md:hidden">Всего</div>
                        </div>
                      </div>

                      {/* За месяц */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">{mat.monthViews}</div>
                          <div className="text-xs text-gray-500 md:hidden">За месяц</div>
                        </div>
                      </div>

                      {/* За день */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{mat.dayViews}</div>
                          <div className="text-xs text-gray-500 md:hidden">За день</div>
                        </div>
                      </div>

                      {/* Лайки (сердечко) — отдельной колонкой */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600" title="Лайки">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            {isCourse ? '—' : mat.social.likes}
                          </span>
                          <div className="text-xs text-gray-500 md:hidden">Лайк</div>
                        </div>
                      </div>

                      {/* В избранном (звезда) — отдельной колонкой */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-500" title="В избранном">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            {isCourse ? '—' : mat.social.favorites}
                          </span>
                          <div className="text-xs text-gray-500 md:hidden">В избранном</div>
                        </div>
                      </div>

                      {/* Цена: бейдж по цене (флаг is_free_preview — «открыт для
                          чтения», бесплатность не делает) */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          {Number(mat.price) === 0 ? (
                            <Badge variant="greenFill">
                              Бесплатно
                            </Badge>
                          ) : (
                            <span className="text-sm font-bold text-purple-700">
                              {mat.price} ₽
                            </span>
                          )}
                          <div className="text-xs text-gray-500 md:hidden">Цена</div>
                        </div>
                      </div>

                      {/* Покупок: сколько раз материал купили (оплаченные) */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className={`text-lg font-bold ${mat.sold > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {mat.sold}
                          </div>
                          <div className="text-xs text-gray-500 md:hidden">Покупок</div>
                        </div>
                      </div>

                      {/* На руки: доход автора с продаж материала — сумма coach_earnings
                          (комиссия фиксируется в момент покупки), только completed */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className={`text-sm font-bold ${mat.earnings > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                            {mat.earnings > 0 ? money(mat.earnings) : '—'}
                          </div>
                          <div className="text-xs text-gray-500 md:hidden">На руки</div>
                        </div>
                      </div>
                    </div>
                  )
                })}

              {/* Пустой результат поиска/фильтра */}
              {filteredMaterials.length === 0 && (
                <div className="px-6 py-10 text-center">
                  <p className="text-gray-600 mb-1">Ничего не найдено</p>
                  <p className="text-sm text-gray-500">Измените поиск или сбросьте фильтр</p>
                </div>
              )}
            </div>
          </Card>

          {/* «Показать ещё» + счётчик */}
          {filteredMaterials.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <p className="text-sm text-gray-500">
                Показано {Math.min(visibleCount, filteredMaterials.length)} из {filteredMaterials.length}
              </p>
              {filteredMaterials.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + 10)}
                  className="px-5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium text-sm transition-colors"
                >
                  Показать ещё {Math.min(10, filteredMaterials.length - visibleCount)}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Если материалов нет */}
      {lessonsStats.length === 0 && coursesStats.length === 0 && (
        <Card variant="glow" padding="none" className="p-12 text-center mb-8">
          <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Пока нет уроков</h2>
          <p className="text-gray-600 mb-6">
            Создайте свой первый урок, чтобы увидеть статистику
          </p>
          <Link
            href="/dashboard/mentor/lessons/new"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать материал
          </Link>
        </Card>
      )}
    </main>
  )
}