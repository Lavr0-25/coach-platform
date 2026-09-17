'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Hint } from '@/components/Hint'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { BookOpen, Eye, FileText, Inbox, Receipt, ShoppingCart, Target, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { sourceLabel } from '@/lib/utm'

// ─────────────────────────── Хелперы ───────────────────────────

// Деньги в русской записи: 1000 → «1 000 ₽»
function money(n: number) {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
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

// Короткая дата дня для оси X: «18 авг»
function dayShort(idx: number, days: number) {
  return new Date(Date.now() - (days - 1 - idx) * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// Дни недели по порядку отображения (Пн → Вс); getDay(): 0 = воскресенье
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DOW_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// Дельта к прошлому периоду: «▲ 34%», «▼ 12%» или null, если сравнивать не с чем
function deltaPct(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? null : { text: 'новое', up: true, noSuffix: true }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return null
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, up: pct > 0, noSuffix: false }
}

// «Красивый» шаг оси Y: из ряда 1-2-5, чтобы подписи были круглыми
function niceStep(x: number) {
  if (x <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(x)))
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= x) return s * p
  return 10 * p
}

// Числовые колонки таблицы «Все материалы», доступные для сортировки
type SortKey = 'reach' | 'impressions' | 'ctr' | 'totalViews' | 'monthViews' | 'dayViews' | 'likes' | 'favorites' | 'sold' | 'earnings'

// Заголовок сортируемой колонки: клик — по убыванию → по возрастанию → сброс
function SortHeader({ label, sortKey, sort, onSort, className, about }: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' } | null
  onSort: (key: SortKey) => void
  className?: string
  about?: string
}) {
  const active = sort?.key === sortKey
  const arrow = active ? (sort!.dir === 'desc' ? '↓' : '↑') : '↕'
  // подсказка — рядом с кнопкой, не внутри: button внутри button недопустим
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className || ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        title="Сортировать: клик — от большего к меньшему, ещё клик — от меньшего к большему, третий — сброс"
        className={`inline-flex items-center gap-1 hover:text-purple-700 transition-colors ${active ? 'text-purple-700' : ''}`}
      >
        {label}
        <span className="text-xs">{arrow}</span>
      </button>
      {about && <Hint text={about} />}
    </span>
  )
}

// ─────────────────────────── Графики ───────────────────────────

// №30: SVG-спарклайн охвата (линия с заливкой, без осей — тренд рядом с цифрой)
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 200
  const H = 30
  const n = values.length
  const max = Math.max(...values, 1)
  const x = (i: number) => (i * W) / Math.max(1, n - 1)
  const y = (v: number) => H - 2 - (v / max) * (H - 4)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7 mt-2" preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// KPI-карточка: подпись + крупная цифра + дельта к прошлому периоду + спарклайн
function KpiCard({ icon: Icon, label, value, delta, hint, about, sparkColor, spark }: {
  icon: LucideIcon
  label: string
  value: string
  delta: { text: string; up: boolean; noSuffix?: boolean } | null
  hint?: string
  about?: string
  sparkColor?: string
  spark?: number[]
}) {
  return (
    <Card variant="glow" padding="none" className="p-5">
      <div className="flex items-start gap-3">
        {/* фирменный бейдж иконки — как в остальном кабинете */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] text-gray-500 truncate flex items-center gap-1" title={label}>
            <span className="truncate">{label}</span>
            {about && <Hint text={about} />}
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          {delta && (
            <div className={`text-xs font-semibold mt-0.5 ${delta.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {delta.text}
              {!delta.noSuffix && <span className="font-normal text-gray-400"> к прошлому периоду</span>}
            </div>
          )}
          {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
        </div>
      </div>
      {spark && sparkColor && <Sparkline values={spark} color={sparkColor} />}
    </Card>
  )
}

// Главный график «по дням»: линия (просмотры) + столбики у нуля (продажи),
// оси со значениями (Y — HTML-подписи, X — даты), строка-подпись под курсором.
// Без библиотек: тот же паттерн, что был в «Динамике охватов» (нативные rect-зоны).
function DailyChart({ values, barValues, period, hover, onHover, lineColor = '#7c3aed', barColor = '#10b981', height = 220 }: {
  values: number[]
  barValues?: number[]          // если заданы — рисуем столбики «от нуля»
  period: number
  hover: number | null
  onHover: (idx: number | null) => void
  lineColor?: string
  barColor?: string
  height?: number
}) {
  const W = 640
  const H = height
  const PAD_T = 10          // отступ сверху до первой линии сетки
  const BASE = H - 20       // базовая линия (ось нуля)
  const PLOT = BASE - PAD_T // высота поля значений
  const n = values.length
  const step = niceStep(Math.max(...values, 1) / 4)
  const top = step * 4
  const x = (i: number) => (i * W) / Math.max(1, n - 1)
  const y = (v: number) => BASE - (v / top) * PLOT
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const maxBar = barValues ? Math.max(...barValues, 1) : 1
  const barW = Math.min(10, (W / Math.max(1, n)) * 0.4)

  // подписи оси Y: 4 круглых значения + 0
  const ticks = [4, 3, 2, 1].map(k => step * k)

  return (
    <div>
      {/* ось Y — HTML-подписи слева (SVG с preserveAspectRatio="none" растягивает текст) */}
      <div className="relative" style={{ paddingLeft: 34 }} onMouseLeave={() => onHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height }} preserveAspectRatio="none">
          {/* сетка */}
          {[0, 1, 2, 3, 4].map(k => (
            <line key={k} x1="0" y1={BASE - (k * PLOT) / 4} x2={W} y2={BASE - (k * PLOT) / 4} stroke="#ece9f4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {/* столбики (продажи) */}
          {barValues && barValues.map((v, i) => {
            const bh = (v / maxBar) * PLOT * 0.35
            if (v <= 0) return null
            return <rect key={i} x={x(i) - barW / 2} y={BASE - bh} width={barW} height={bh} rx="2" fill={barColor} />
          })}
          {/* линия (просмотры) */}
          <path d={line} fill="none" stroke={lineColor} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {/* невидимые зоны наведения по дням */}
          {values.map((_, i) => (
            <rect
              key={i}
              x={x(i) - W / (2 * (n - 1))}
              y={0}
              width={W / (n - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => onHover(i)}
              className="cursor-pointer"
            />
          ))}
        </svg>
        {/* подписи оси Y */}
        <div className="absolute left-0 top-0 w-8 pointer-events-none" style={{ height }}>
          {ticks.map((t, k) => (
            <span
              key={k}
              className="absolute right-1.5 text-[11px] text-gray-400 -translate-y-1/2"
              style={{ top: `${((BASE - (t / top) * PLOT) / H) * 100}%` }}
            >
              {t >= 1000 ? `${(t / 1000).toLocaleString('ru-RU')}к` : t}
            </span>
          ))}
          <span className="absolute right-1.5 text-[11px] text-gray-400 -translate-y-1/2" style={{ top: `${(BASE / H) * 100}%` }}>0</span>
        </div>
      </div>
      {/* ось X — даты */}
      <div className="flex justify-between text-[11px] text-gray-400 mt-1" style={{ paddingLeft: 34 }}>
        {[0, 1, 2, 3, 4, 5].map(k => {
          const idx = Math.round((k * (n - 1)) / 5)
          return <span key={k} className={k === 0 ? '' : 'translate-x-2'}>{dayShort(idx, period)}</span>
        })}
      </div>
      {/* подпись под курсором */}
      <p className="text-sm text-gray-600 mt-2 min-h-[20px]">
        {hover === null ? (
          <span className="text-gray-400">Наведите на график — цифры за день</span>
        ) : (
          <>
            <b className="text-gray-900">{dayLabel(hover, period)}</b>
            {' — '}{values[hover]} {plural(values[hover], 'просмотр', 'просмотра', 'просмотров')}
            {barValues && <> · {barValues[hover]} {plural(barValues[hover], 'продажа', 'продажи', 'продаж')}</>}
          </>
        )}
      </p>
    </div>
  )
}

// «Когда читают»: просмотры по дням недели — DOM-столбики со значением сверху
function DowChart({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1)
  const best = counts.indexOf(Math.max(...counts))
  const BAR_PX = 90 // высота самого высокого столбика (в px — проценты тут не работают: высота родителя auto)
  return (
    <div>
      <div className="flex items-end gap-2 mt-4">
        {DOW_ORDER.map((d, i) => (
          <div key={d} className="flex-1 flex flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-bold text-purple-700">{counts[i] || ''}</span>
            <div
              className={`w-full rounded-lg ${i === best ? 'bg-purple-600' : 'bg-purple-300'}`}
              style={{ height: `${Math.max(Math.round((counts[i] / max) * BAR_PX), counts[i] > 0 ? 6 : 2)}px` }}
            ></div>
            <span className="text-[11px] text-gray-400">{DOW_LABELS[i]}</span>
          </div>
        ))}
      </div>
      {Math.max(...counts) > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          Самый читаемый день — <b className="text-gray-700">{DOW_LABELS[best].toLowerCase()}</b>. Публикуйте посты ближе к нему
        </p>
      )}
    </div>
  )
}

// «Откуда приходят читатели»: горизонтальные полосы с процентами
function SourceBars({ sources, total }: { sources: Record<string, number>; total: number }) {
  const rows = Object.entries(sources).sort((a, b) => b[1] - a[1])
  if (total === 0) {
    return <p className="text-sm text-gray-400 mt-3">Пока нет переходов за период</p>
  }
  return (
    <div>
      {rows.map(([src, count]) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={src} className="grid grid-cols-[100px_1fr_44px] items-center gap-2.5 mt-2.5 text-[13px]" title={`${sourceLabel(src)}: ${count}`}>
            <span className="truncate text-gray-700">{sourceLabel(src)}</span>
            <span className="h-2.5 rounded-md bg-purple-50 overflow-hidden block">
              <span className="block h-full rounded-md bg-purple-600" style={{ width: `${Math.max(pct, 2)}%` }}></span>
            </span>
            <span className="text-right text-xs font-semibold text-gray-400">{pct}%</span>
          </div>
        )
      })}
      <p className="text-[11px] text-gray-400 mt-3">Проценты — от всех просмотров периода (метки utm + ссылающиеся страницы)</p>
    </div>
  )
}

// №30: карточка материала в «Обзоре» — график просмотров за период + источники
function ReachCard({ r, max, period }: {
  r: { id: string; type: 'lesson' | 'course'; title: string; total: number; series: number[]; sources: Record<string, number> }
  max: number
  period: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 300
  const H = 90
  const PAD = 6
  const n = r.series.length
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1)
  const y = (v: number) => H - PAD - (max > 0 ? (v / max) * (H - 2 * PAD) : 0)
  const line = r.series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
  const topSources = Object.entries(r.sources).sort((a, b) => b[1] - a[1]).slice(0, 4)

  return (
    <Card variant="glow" padding="none" className="p-5">
      <Link
        href={`/mentor/analytics/${r.id}`}
        className="block mb-0.5 font-semibold text-gray-900 truncate hover:text-purple-600 transition-colors"
        title={r.title}
      >
        {r.type === 'course' && (
          <span title="Курс" className="mr-1 inline-flex align-[-2px] text-blue-600">
            <BookOpen className="h-4 w-4" />
          </span>
        )}
        {r.title}
      </Link>
      <p className="text-xs text-gray-500 mb-2">
        Просмотров за {period} {plural(period, 'день', 'дня', 'дней')}: <span className="font-bold text-purple-700">{r.total}</span>
      </p>
      <p className="text-xs text-gray-600 mb-2 min-h-[16px]">
        {hover === null ? (
          <span className="text-gray-400">Наведите на график — цифры за день</span>
        ) : (
          <>
            <b className="text-gray-900">{dayLabel(hover, period)}</b>
            {' — '}{r.series[hover]} {plural(r.series[hover], 'просмотр', 'просмотра', 'просмотров')} страницы материала, включая гостей
          </>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`reach-${r.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#reach-${r.id})`} />
        <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {r.series.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - 2 * PAD) / (2 * Math.max(1, n - 1))}
            y={0}
            width={(W - 2 * PAD) / Math.max(1, n - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            className="cursor-pointer"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {topSources.map(([src, count]) => (
          <span key={src} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2 py-0.5">
            {sourceLabel(src)}: {count}
          </span>
        ))}
      </div>
    </Card>
  )
}

// ─────────────────────────── Страница ───────────────────────────

type TabKey = 'overview' | 'materials' | 'sales'
type PeriodKey = 7 | 30 | 90

// Сырые события просмотров (180 дней) — из них считаются все графики периода
type ViewEvent = { key: string; ts: number; src: string }
// Покупка/списание (completed) с меткой времени
type SaleRow = { id: string; buyer: string; title: string; amount: number; earnings: number; ts: number }

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [coach, setCoach] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Вкладка и период (7 / 30 / 90 дней)
  const [tab, setTab] = useState<TabKey>('overview')
  const [period, setPeriod] = useState<PeriodKey>(30)

  // Статистика (не зависит от периода — считаем по всем материалам)
  const [stats, setStats] = useState({
    subscribers: 0,
    totalViews: 0,
    totalCompleted: 0,
  })
  const [lessonsStats, setLessonsStats] = useState<any[]>([])
  const [coursesStats, setCoursesStats] = useState<any[]>([])
  // Охваты за 30 дней (фиксированные) — для колонки «Охваты» таблицы материалов
  const [reach, setReach] = useState<Array<{ id: string; type: 'lesson' | 'course'; total30: number }>>([])
  // Продажи: покупки + списания подписок, все completed (RLS отбирает свои)
  const [salesRows, setSalesRows] = useState<SaleRow[]>([])
  const [allTimeEarnings, setAllTimeEarnings] = useState(0)
  // Сырые события просмотров за 180 дней (для графиков по любому периоду)
  const [viewEvents, setViewEvents] = useState<ViewEvent[]>([])
  // Сырые записи прогресса (авторизованные ученики) — график «Завершения»
  const [progressRows, setProgressRows] = useState<Array<{ lesson_id: string; ts: number; status: string }>>([])
  // Показы и клики карточек каталога (CTR) — 30 дней, по материалам
  const [catalogStats, setCatalogStats] = useState<Map<string, { impressions: number; clicks: number }>>(new Map())

  // Управление таблицей «Все материалы»: поиск, фильтр, порционная выдача, сортировка
  const [tableSearch, setTableSearch] = useState('')
  const [tableFilter, setTableFilter] = useState<'all' | 'reach' | 'sold' | 'read'>('all')
  const [visibleCount, setVisibleCount] = useState(10)
  const [tableSort, setTableSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
  // Курсор на графиках
  const [mainHover, setMainHover] = useState<number | null>(null)
  const [metricHover, setMetricHover] = useState<number | null>(null)
  // Показатель на вкладке «Материалы»
  const [metric, setMetric] = useState<'views' | 'completed' | 'sales'>('views')

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

      // Материалы автора
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

      const totalLessons = allLessons?.length || 0

      // Курсы автора
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, title, cover_image, price, created_at')
        .eq('coach_id', coachData.id)

      const courseIds = allCourses?.map(c => c.id) || []

      // Состав курсов — чтобы «Просмотры» курса считались по lesson_progress его уроков
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

      // Подписчики (фоловеры) — уникальные пользователи
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('coach_id', user.id)
      const subscribersCount = new Set(subsData?.map(s => s.user_id) || []).size

      // Прогресс учеников (lesson_progress): просмотры/завершения, всего
      const { data: allProgress } = await supabase
        .from('lesson_progress')
        .select('lesson_id, user_id, status, started_at, completed_at')
        .in('lesson_id', lessonIds)

      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // 💰 Продажи: покупки наших уроков и курсов. В деньгах считаем только
      // completed — pending значит «оплата не дошла» и деньгами не является.
      // «На руки» берём из coach_earnings (комиссия фиксируется в момент покупки).
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('id, lesson_id, course_id, amount, coach_earnings, payment_status, user_id, purchased_at')
        .order('purchased_at', { ascending: false })

      // Платные подписки на автора (Ф3): списания из журнала subscription_payments
      const { data: subPaymentsData } = await supabase
        .from('subscription_payments')
        .select('id, amount, coach_earnings, status, period_months, user_id, paid_at, created_at')
        .order('paid_at', { ascending: false })

      const lessonTitle = new Map<string, string>((allLessons || []).map((l: any) => [l.id, l.title]))
      const courseTitle = new Map<string, string>((allCourses || []).map((c: any) => [c.id, c.title]))

      // Имена покупателей — отдельным запросом по профилям
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

      // Сколько раз куплен каждый материал и доход с него — для таблицы
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

      const salesRows: SaleRow[] = completedPurchases.map((p: any) => ({
        id: p.id,
        buyer: buyerName.get(p.user_id) || 'Ученик',
        title: lessonTitle.get(p.lesson_id || '') || courseTitle.get(p.course_id || '') || 'Материал',
        amount: Number(p.amount || 0),
        earnings: Number(p.coach_earnings ?? p.amount ?? 0),
        ts: new Date(p.purchased_at).getTime(),
      }))

      // Списания подписок — те же строки продаж
      for (const sp of (subPaymentsData || []).filter((sp: any) => sp.status === 'completed')) {
        salesRows.push({
          id: `sub-${sp.id}`,
          buyer: buyerName.get(sp.user_id) || 'Ученик',
          title: `Подписка на автора · ${sp.period_months} мес.`,
          amount: Number(sp.amount || 0),
          earnings: Number(sp.coach_earnings ?? sp.amount ?? 0),
          ts: new Date(sp.paid_at || sp.created_at).getTime(),
        })
      }
      salesRows.sort((a, b) => b.ts - a.ts)
      setSalesRows(salesRows)
      setAllTimeEarnings(salesRows.reduce((s, r) => s + r.earnings, 0))

      // №30: события просмотров за 180 дней — из них собираются все графики
      // (КПЭ, источники, «когда читают», топ материалов). Гостевые события
      // (user_id IS NULL) RLS тоже отдаёт — фильтр только по нашим материалам.
      // Показы/клики каталога (CTR) считаем отдельно, в охваты они не входят.
      const days180Ago = new Date(now.getTime() - 180 * 86400000)
      const viewEvents: ViewEvent[] = []
      // Охваты за 30 дней — для колонки «Охваты» таблицы материалов
      const reach30ByKey = new Map<string, number>()
      const catalog30 = new Map<string, { impressions: number; clicks: number }>()
      if (lessonIds.length > 0 || courseIds.length > 0) {
        const { data: viewsData } = await supabase
          .from('analytics_events')
          .select('event_type, target_id, target_type, created_at, metadata')
          .in('target_id', [...lessonIds, ...courseIds])
          .gte('created_at', days180Ago.toISOString())

        const keyOf = (type: string, tid: string) => `${type}:${tid}`
        for (const ev of viewsData || []) {
          const ts = new Date(ev.created_at).getTime()
          // Показы/клики каталога — в отдельную воронку, не в просмотры страниц
          if (ev.event_type === 'catalog_impression' || ev.event_type === 'catalog_click') {
            if (ts >= oneMonthAgo.getTime()) {
              const k = keyOf(ev.target_type, ev.target_id)
              const cur = catalog30.get(k) || { impressions: 0, clicks: 0 }
              if (ev.event_type === 'catalog_impression') cur.impressions++
              else cur.clicks++
              catalog30.set(k, cur)
            }
            continue
          }
          // Сюда попадают только просмотры страниц (lesson_view) — на случай
          // появления новых типов событий охват не должен их поглощать
          if (ev.event_type && ev.event_type !== 'lesson_view') continue
          viewEvents.push({
            key: keyOf(ev.target_type, ev.target_id),
            ts,
            src: (ev.metadata as any)?.source || 'direct',
          })
          if (ts >= oneMonthAgo.getTime()) {
            const k = keyOf(ev.target_type, ev.target_id)
            reach30ByKey.set(k, (reach30ByKey.get(k) || 0) + 1)
          }
        }
      }
      setCatalogStats(catalog30)
      setViewEvents(viewEvents)
      setReach(
        [...lessonIds.map(id => ({ id, type: 'lesson' as const })), ...courseIds.map(id => ({ id, type: 'course' as const }))]
          .map(m => ({ ...m, total30: reach30ByKey.get(`${m.type}:${m.id}`) || 0 }))
      )

      setProgressRows((allProgress || []).map((p: any) => ({
        lesson_id: p.lesson_id,
        ts: new Date(p.started_at).getTime(),
        status: p.status,
      })))

      // Статистика по каждому уроку (таблица «Все материалы»)
      const lessons = allLessons?.map(lesson => {
        const lessonProgress = allProgress?.filter(p => p.lesson_id === lesson.id) || []
        return {
          ...lesson,
          type: 'lesson' as const,
          totalViews: lessonProgress.length,
          monthViews: lessonProgress.filter(p => new Date(p.started_at) >= oneMonthAgo).length,
          dayViews: lessonProgress.filter(p => new Date(p.started_at) >= oneDayAgo).length,
          sold: salesByLesson.get(lesson.id) || 0,
          earnings: earningsByLesson.get(lesson.id) || 0,
          social: socialByLesson.get(lesson.id) || { likes: 0, favorites: 0 },
        }
      }) || []

      // Статистика по каждому курсу
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
        subscribers: subscribersCount,
        totalViews: allProgress?.length || 0,
        totalCompleted: allProgress?.filter(p => p.status === 'completed').length || 0,
      })
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

  const coachName = coach?.display_name || 'автора'

  // ── Пересчёт агрегатов под выбранный период (из сырых событий) ──
  const now = Date.now()
  const periodStart = now - period * 86400000
  const prevStart = now - 2 * period * 86400000
  const dayIdxOf = (ts: number) => period - 1 - Math.floor((now - ts) / 86400000)

  // Просмотры по дням (все материалы, включая гостей)
  const viewsDaily = Array(period).fill(0) as number[]
  const sources: Record<string, number> = {}
  // Топ материалов за период: серия по дням + сумма + источники
  const seriesByKey = new Map<string, number[]>()
  const sourcesByKey = new Map<string, Record<string, number>>()
  let viewsCur = 0
  let viewsPrev = 0
  for (const ev of viewEvents) {
    if (ev.ts >= periodStart) {
      viewsCur++
      sources[ev.src] = (sources[ev.src] || 0) + 1
      const idx = dayIdxOf(ev.ts)
      if (idx >= 0 && idx < period) {
        viewsDaily[idx]++
        let arr = seriesByKey.get(ev.key)
        if (!arr) {
          arr = Array(period).fill(0) as number[]
          seriesByKey.set(ev.key, arr)
        }
        arr[idx]++
        let s = sourcesByKey.get(ev.key)
        if (!s) {
          s = {}
          sourcesByKey.set(ev.key, s)
        }
        s[ev.src] = (s[ev.src] || 0) + 1
      }
    } else if (ev.ts >= prevStart) {
      viewsPrev++
    }
  }

  // Продажи по дням (покупки + подписки, completed)
  const salesDaily = Array(period).fill(0) as number[]
  const earningsDaily = Array(period).fill(0) as number[]
  const salesInPeriod: SaleRow[] = []
  let salesPrev = 0
  let earningsPrev = 0
  let paidSumPrev = 0 // «Оплачено» за прошлый период — дельта на вкладке «Продажи»
  for (const s of salesRows) {
    if (s.ts >= periodStart) {
      salesInPeriod.push(s)
      const idx = dayIdxOf(s.ts)
      if (idx >= 0 && idx < period) {
        salesDaily[idx]++
        earningsDaily[idx] += s.earnings
      }
    } else if (s.ts >= prevStart) {
      salesPrev++
      earningsPrev += s.earnings
      paidSumPrev += s.amount
    }
  }
  const earningsCur = salesInPeriod.reduce((sum, s) => sum + s.earnings, 0)

  // Завершения уроков по дням (авторизованные ученики)
  const completedDaily = Array(period).fill(0) as number[]
  for (const p of progressRows) {
    if (p.status === 'completed' && p.ts >= periodStart) {
      const idx = dayIdxOf(p.ts)
      if (idx >= 0 && idx < period) completedDaily[idx]++
    }
  }

  // «Когда читают»: просмотры по дням недели за период
  const dowCounts = Array(7).fill(0) as number[]
  for (const ev of viewEvents) {
    if (ev.ts >= periodStart) dowCounts[DOW_ORDER.indexOf(new Date(ev.ts).getDay())]++
  }

  // Конверсия «просмотр → покупка» за период и прошлый
  const convCur = viewsCur > 0 ? (salesInPeriod.length / viewsCur) * 100 : 0
  const convPrev = viewsPrev > 0 ? (salesPrev / viewsPrev) * 100 : 0

  // Топ-3 материала за период (серии из событий)
  const materialsByKey = new Map<string, { id: string; type: 'lesson' | 'course'; title: string }>()
  for (const l of lessonsStats) materialsByKey.set(`lesson:${l.id}`, { id: l.id, type: 'lesson', title: l.title })
  for (const c of coursesStats) materialsByKey.set(`course:${c.id}`, { id: c.id, type: 'course', title: c.title })
  const topReach = [...materialsByKey.entries()]
    .map(([key, m]) => {
      const series = seriesByKey.get(key) || Array(period).fill(0) as number[]
      return { ...m, series, total: series.reduce((a, b) => a + b, 0), sources: sourcesByKey.get(key) || {} }
    })
    .sort((a, b) => b.total - a.total)
    .filter(r => r.total > 0)
  const topMax = Math.max(1, ...topReach.map(r => Math.max(...r.series)))

  // Инициализация серии по каждому материалу (seriesByKey заполняется выше
  // только при событиях — предзаполняем нулями, чтобы карточки не падали)
  for (const key of materialsByKey.keys()) {
    if (!seriesByKey.has(key)) seriesByKey.set(key, Array(period).fill(0) as number[])
    if (!sourcesByKey.has(key)) sourcesByKey.set(key, {})
  }

  // Таблица «Все материалы» (без изменений: поиск + фильтр + сортировка + порции)
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
        case 'impressions': return catalogStats.get(`${m.type}:${m.id}`)?.impressions || 0
        case 'ctr': {
          const c = catalogStats.get(`${m.type}:${m.id}`)
          return c && c.impressions > 0 ? (c.clicks / c.impressions) * 100 : -1
        }
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

  // Продажи выбранного периода для вкладки «Продажи»
  const salesForTable = salesRows.filter(s => s.ts >= periodStart)
  const paidSum = salesForTable.reduce((sum, s) => sum + s.amount, 0)
  const netSum = salesForTable.reduce((sum, s) => sum + s.earnings, 0)

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      <MentorSectionNav className="mb-6" />

      {/* Шапка: заголовок + период */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">Аналитика</h1>
          <p className="text-gray-600">
            Сводка по каналу «{coachName}» за последние {period} {plural(period, 'день', 'дня', 'дней')}
          </p>
        </div>
        <div className="flex bg-white border border-purple-100 rounded-xl p-1 gap-0.5 self-start sm:self-auto">
          {([7, 30, 90] as PeriodKey[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                period === p ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-purple-600'
              }`}
            >
              {p} {plural(p, 'день', 'дня', 'дней')}
            </button>
          ))}
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 border-b-2 border-purple-50 mb-6 overflow-x-auto no-scrollbar">
        {([
          { key: 'overview', label: 'Обзор' },
          { key: 'materials', label: 'Материалы' },
          { key: 'sales', label: 'Продажи' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-[15px] font-semibold border-b-2 -mb-0.5 transition-colors whitespace-nowrap ${
              tab === t.key ? 'text-purple-600 border-purple-600' : 'text-gray-400 border-transparent hover:text-purple-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═════════ ВКЛАДКА «ОБЗОР» ═════════ */}
      {tab === 'overview' && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard
              icon={Wallet}
              label={`На руки за ${period} ${plural(period, 'день', 'дня', 'дней')}`}
              about="Ваша выручка за период после удержания комиссии платформы — то, что реально придёт на выплату."
              value={money(earningsCur)}
              delta={deltaPct(earningsCur, earningsPrev)}
              spark={earningsDaily}
              sparkColor="#7c3aed"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Продаж"
              about="Сколько раз оплатили ваши материалы за период. Покупка засчитывается после подтверждения платежа платёжной системой."
              value={String(salesInPeriod.length)}
              delta={deltaPct(salesInPeriod.length, salesPrev)}
              spark={salesDaily}
              sparkColor="#10b981"
            />
            <KpiCard
              icon={Eye}
              label="Просмотров (включая гостей)"
              about="Сколько раз открыли страницы ваших материалов, включая неавторизованных читателей из соцсетей и поиска."
              value={viewsCur.toLocaleString('ru-RU')}
              delta={deltaPct(viewsCur, viewsPrev)}
              spark={viewsDaily}
              sparkColor="#7c3aed"
            />
            <KpiCard
              icon={Target}
              label="Конверсия просмотр → покупка"
              about="Доля посетителей страниц, которые купили материал. Много просмотров при низкой конверсии — повод доработать описание, обложку или цену."
              value={`${convCur.toFixed(1).replace('.', ',')}%`}
              delta={viewsPrev > 0 ? deltaPct(convCur, convPrev) : null}
              hint={salesInPeriod.length > 0 && viewsCur > 0 ? `${salesInPeriod.length} ${plural(salesInPeriod.length, 'продажа', 'продажи', 'продаж')} из ${viewsCur.toLocaleString('ru-RU')}` : undefined}
            />
          </div>

          {/* График + источники */}
          <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4 mb-4">
            <Card variant="glow" padding="none" className="p-5">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                Просмотры и продажи по дням
                <Hint text="Просмотры страниц ваших материалов и оплаты по дням. Пики подскажут, какие публикации приводят читателей — повторяйте то, что работает." />
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Просмотры страниц материалов (включая гостей) и оплаченные покупки
              </p>
              {viewsCur > 0 || salesInPeriod.length > 0 ? (
                <DailyChart
                  values={viewsDaily}
                  barValues={salesDaily}
                  period={period}
                  hover={mainHover}
                  onHover={setMainHover}
                />
              ) : (
                <div className="py-10 text-center">
                  <p className="text-gray-600 mb-1">Пока нет просмотров за выбранный период</p>
                  <p className="text-sm text-gray-500">Поделитесь ссылкой на материал — подсчёт ведётся с 16.09, включая неавторизованных читателей</p>
                </div>
              )}
            </Card>

            <Card variant="glow" padding="none" className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  Аудитория
                  <Hint text="Читатели, подписанные на ваши обновления: новые материалы появятся у них в ленте и в уведомлениях." />
                </h3>
                <Link href="/dashboard/mentor/subscribers" className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                  Подписчики: {stats.subscribers} →
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Подписчики — читатели, подписанные на обновления</p>
              <h4 className="text-sm font-semibold text-gray-700 mt-5 mb-1 flex items-center gap-2">
                Откуда приходят читатели
                <Hint text="Откуда переходы: соцсети и мессенджеры видны по меткам utm в ссылках, остальное — по ссылающейся странице. Помогает понять, какую площадку стоит развивать." />
              </h4>
              <SourceBars sources={sources} total={viewsCur} />
            </Card>
          </div>

          {/* Топ материалов + когда читают */}
          <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4">
            <Card variant="glow" padding="none" className="p-5">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                Лучшие материалы за период
                <Hint text="Три материала с самым большим охватом. Смотрите, какие темы заходят — на них и опирайтесь в следующих публикациях." />
              </h3>
              {topReach.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    {topReach.slice(0, 3).map(r => (
                      <ReachCard key={`${r.type}-${r.id}`} r={r} max={topMax} period={period} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    Показаны 3 самых просматриваемых материала — остальные в{' '}
                    <button onClick={() => setTab('materials')} className="text-purple-600 hover:text-purple-700 font-medium">
                      таблице «Материалы»
                    </button>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-4">
                  Пока нет просмотров за период — откройте{' '}
                  <button onClick={() => setTab('materials')} className="text-purple-600 hover:text-purple-700 font-medium">
                    вкладку «Материалы»
                  </button>
                  , там вся статистика по материалам
                </p>
              )}
            </Card>

            <Card variant="glow" padding="none" className="p-5">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                Когда читают
                <Hint text="Просмотры по дням недели. Самый читаемый день — ориентир для публикации: выходите за день-два до пика." />
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Просмотры по дням недели за период</p>
              <DowChart counts={dowCounts} />
            </Card>
          </div>
        </>
      )}

      {/* ═════════ ВКЛАДКА «МАТЕРИАЛЫ» ═════════ */}
      {tab === 'materials' && (
        <>
          {/* График показателя по дням */}
          <Card variant="glow" padding="none" className="p-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                Показатель по дням — все материалы
                <Hint text="Суммарно по всем вашим материалам: просмотры, завершения чтения или продажи — переключается кнопками справа." />
              </h3>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'views', label: 'Просмотры' },
                  { key: 'completed', label: 'Завершения' },
                  { key: 'sales', label: 'Продажи' },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMetric(m.key)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      metric === m.key
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-500 border-purple-100 hover:border-purple-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              {metric === 'views' && 'Просмотры страниц всех материалов по дням, включая неавторизованных читателей'}
              {metric === 'completed' && 'Сколько учеников завершили уроки по дням (авторизованные читатели)'}
              {metric === 'sales' && 'Оплаченные покупки уроков, курсов и подписок по дням'}
            </p>
            <DailyChart
              values={metric === 'views' ? viewsDaily : metric === 'completed' ? completedDaily : salesDaily}
              period={period}
              hover={metricHover}
              onHover={setMetricHover}
            />
          </Card>

          {/* Таблица всех материалов — как раньше */}
          {(lessonsStats.length > 0 || coursesStats.length > 0) && (
            <div>
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
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 pt-3 bg-purple-50 text-xs font-medium text-gray-500">
                  {/* надзаголовки-группы над колонками каталога и открытий */}
                  <div className="col-span-3"></div>
                  <div className="col-span-2 text-center">Каталог</div>
                  <div className="col-span-3 text-center">Открытия</div>
                  <div className="col-span-4"></div>
                </div>
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 pb-3 bg-purple-50 border-b border-purple-100 text-sm font-semibold text-gray-700">
                  <div className="col-span-2">Материал</div>
                  <div className="col-span-1 text-center">
                    <SortHeader label="Охваты" sortKey="reach" sort={tableSort} onSort={toggleSort} about="Сколько раз открыли страницу материала за выбранный период, включая гостей. Клик — переход к детальной статистике." />
                  </div>
                  {/* группа «Каталог» — показы карточек на главной и CTR */}
                  <div className="col-span-2 grid grid-cols-2 gap-2 rounded-lg bg-purple-100/60 py-1.5">
                    <div className="text-center">
                      <SortHeader label="Показы" sortKey="impressions" sort={tableSort} onSort={toggleSort} about="Сколько раз карточку материала показали на главной за 30 дней. Один показ на карточку за сессию браузера." />
                    </div>
                    <div className="text-center">
                      <SortHeader label="CTR" sortKey="ctr" sort={tableSort} onSort={toggleSort} about="Кликабельность карточки: клики / показы. Растёт, когда обложка и название цепляют." />
                    </div>
                  </div>
                  {/* группа «Открытия» — три колонки на общей подложке */}
                  <div className="col-span-3 grid grid-cols-3 gap-2 rounded-lg bg-purple-100/60 py-1.5">
                    <div className="text-center">
                      <SortHeader label="Всего" sortKey="totalViews" sort={tableSort} onSort={toggleSort} about="Открытия материала зарегистрированными учениками за всё время: сколько раз начинали читать." />
                    </div>
                    <div className="text-center">
                      <SortHeader label="За месяц" sortKey="monthViews" sort={tableSort} onSort={toggleSort} about="Начали читать за последние 30 дней." />
                    </div>
                    <div className="text-center">
                      <SortHeader label="За день" sortKey="dayViews" sort={tableSort} onSort={toggleSort} about="Начали читать за последние 24 часа." />
                    </div>
                  </div>
                  <div className="col-span-1 text-center">
                    <SortHeader label="Лайк" sortKey="likes" sort={tableSort} onSort={toggleSort} about="«Сердечки» от читателей за всё время. У курсов лайков не бывает." />
                  </div>
                  <div className="col-span-1 text-center">
                    <SortHeader label="Избранное" sortKey="favorites" sort={tableSort} onSort={toggleSort} about="Добавления материала в избранное за всё время." />
                  </div>
                  <div className="col-span-1 text-center">Цена</div>
                  <div className="col-span-1 text-center">
                    <SortHeader label="Покупок" sortKey="sold" sort={tableSort} onSort={toggleSort} about="Оплаченные покупки материала за выбранный период." />
                  </div>
                  <div className="col-span-1 text-center">
                    <SortHeader label="На руки" sortKey="earnings" sort={tableSort} onSort={toggleSort} about="Ваша выручка по материалу за период после комиссии платформы." />
                  </div>
                </div>

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
                          onClick={() => router.push(`/mentor/analytics/${mat.id}`)}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-purple-50/50 transition-colors group cursor-pointer"
                          title="Открыть статистику материала"
                        >
                          {/* Материал */}
                          <div className="col-span-2 flex items-center gap-3">
                            <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
                              {(mat.cover_image || mat.cover_image_url) ? (
                                <Image
                                  src={mat.cover_image || mat.cover_image_url}
                                  alt={mat.title}
                                  fill
                                  sizes="64px"
                                  className="w-full h-full object-cover"
                                />
                              ) : isCourse ? (
                                <BookOpen className="h-6 w-6 text-white opacity-60" strokeWidth={1.5} />
                              ) : (
                                <FileText className="h-6 w-6 text-white opacity-60" strokeWidth={1.5} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={editHref}
                                onClick={(e) => e.stopPropagation()}
                                className="font-semibold text-gray-900 hover:text-purple-600 transition-colors truncate block"
                                title={`${mat.title} — открыть редактор`}
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

                          {/* Охваты за 30 дней — клик открывает подробную статистику */}
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

                          {/* Каталог: показы карточки на главной + CTR (клики/показы) */}
                          <div className="col-span-2 grid grid-cols-2 gap-2 rounded-lg bg-purple-50 py-1.5">
                            <div className="flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-lg font-bold text-gray-700" title="Сколько раз карточку показали на главной за 30 дней">
                                  {catalogStats.get(`${mat.type}:${mat.id}`)?.impressions || 0}
                                </div>
                                <div className="text-xs text-gray-500 md:hidden">Показы</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-center">
                              <div className="text-center">
                                {(() => {
                                  const c = catalogStats.get(`${mat.type}:${mat.id}`)
                                  const ctr = c && c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null
                                  return (
                                    <div className={`text-lg font-bold ${ctr === null ? 'text-gray-400' : 'text-blue-600'}`} title="Клики по карточке / показы, за 30 дней">
                                      {ctr === null ? '—' : `${ctr.toFixed(1).replace('.', ',')}%`}
                                    </div>
                                  )
                                })()}
                                <div className="text-xs text-gray-500 md:hidden">CTR</div>
                              </div>
                            </div>
                          </div>

                          {/* группа «Открытия» — три колонки на общей подложке */}
                          <div className="col-span-3 grid grid-cols-3 gap-2 rounded-lg bg-purple-50 py-1.5">
                            <div className="flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-lg font-bold gradient-text">{mat.totalViews}</div>
                                <div className="text-xs text-gray-500 md:hidden">Всего</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-600">{mat.monthViews}</div>
                                <div className="text-xs text-gray-500 md:hidden">За месяц</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">{mat.dayViews}</div>
                                <div className="text-xs text-gray-500 md:hidden">За день</div>
                              </div>
                            </div>
                          </div>

                          {/* Лайки */}
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

                          {/* В избранном */}
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

                          {/* Цена */}
                          <div className="col-span-1 flex items-center justify-center">
                            <div className="text-center">
                              {Number(mat.price) === 0 ? (
                                <Badge variant="greenFill">Бесплатно</Badge>
                              ) : (
                                <span className="text-sm font-bold text-purple-700">{mat.price} ₽</span>
                              )}
                              <div className="text-xs text-gray-500 md:hidden">Цена</div>
                            </div>
                          </div>

                          {/* Покупок */}
                          <div className="col-span-1 flex items-center justify-center">
                            <div className="text-center">
                              <div className={`text-lg font-bold ${mat.sold > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {mat.sold}
                              </div>
                              <div className="text-xs text-gray-500 md:hidden">Покупок</div>
                            </div>
                          </div>

                          {/* На руки */}
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

          {lessonsStats.length === 0 && coursesStats.length === 0 && (
            <Card variant="glow" padding="none" className="p-12 text-center">
              <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Пока нет уроков</h2>
              <p className="text-gray-600 mb-6">Создайте свой первый урок, чтобы увидеть статистику</p>
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
        </>
      )}

      {/* ═════════ ВКЛАДКА «ПРОДАЖИ» ═════════ */}
      {tab === 'sales' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
            <KpiCard
              icon={Receipt}
              label={`Оплачено за ${period} ${plural(period, 'день', 'дня', 'дней')}`}
              value={money(paidSum)}
              delta={deltaPct(paidSum, paidSumPrev)}
            />
            <KpiCard
              icon={Wallet}
              label="На руки (после комиссии)"
              value={money(netSum)}
              delta={deltaPct(netSum, earningsPrev)}
              spark={earningsDaily}
              sparkColor="#7c3aed"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Покупок"
              value={String(salesForTable.length)}
              delta={deltaPct(salesForTable.length, salesPrev)}
            />
          </div>
          <p className="text-sm text-gray-500 mb-4">
            За всё время: {salesRows.length} {plural(salesRows.length, 'продажа', 'продажи', 'продаж')} на руки {money(allTimeEarnings)}
          </p>

          {salesForTable.length > 0 ? (
            <Card variant="glow" padding="none" className="overflow-hidden border border-purple-100">
              {/* Итог периода */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-4 px-6 py-3 bg-purple-50 font-semibold text-gray-700">
                <div className="md:col-span-7">Всего за период</div>
                <div className="md:col-span-2 text-center">{money(paidSum)}</div>
                <div className="md:col-span-3 text-center text-emerald-600">{money(netSum)}</div>
              </div>
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-purple-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <div className="col-span-3">Покупатель</div>
                <div className="col-span-4">Материал</div>
                <div className="col-span-2 text-center">Дата</div>
                <div className="col-span-1 text-center">Оплачено</div>
                <div className="col-span-2 text-center">На руки</div>
              </div>
              <div className="divide-y divide-purple-50">
                {salesForTable.map((s) => (
                  <div key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-4 px-6 py-4">
                    <div className="col-span-3 font-semibold text-gray-900">{s.buyer}</div>
                    <div className="col-span-4 text-gray-700 truncate">{s.title}</div>
                    <div className="col-span-2 text-center text-sm text-gray-500">
                      {new Date(s.ts).toLocaleString('ru-RU', {
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
              <p className="text-gray-600 mb-1">За выбранный период продаж нет</p>
              <p className="text-sm text-gray-500">
                Как только кто-то купит ваш урок или курс — или оформит подписку, покупка появится здесь
              </p>
            </div>
          )}
        </>
      )}
    </main>
  )
}