'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Hint } from '@/components/Hint'
import { Card } from '@/components/ui/Card'
import { BookOpen, Eye, FileText, Heart, Inbox, MousePointerClick, ShoppingCart, Star, Target, Wallet } from 'lucide-react'
import { sourceLabel } from '@/lib/utm'

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

// Короткая дата для оси X графика: «18 авг»
function dayShort(idx: number, days: number) {
  return new Date(Date.now() - (days - 1 - idx) * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// «Красивый» шаг оси Y: ряд 1, 2, 2.5, 5 × 10^n — чтобы подписи были круглыми
function niceStep(x: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, x))))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= x) return m * pow
  }
  return 10 * pow
}

const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
] as const

type MaterialInfo = {
  id: string
  type: 'lesson' | 'course'
  title: string
  price: number
  cover: string | null
  created_at: string
}

// Детальная статистика одного материала (№30, 2026-09-16): переход по клику
// на «Охваты» в таблице «Все материалы». Период 7/30/90 дней, график
// просмотров и покупок по дням, источники переходов, деньги, реакции.
export default function MaterialAnalyticsPage() {
  const supabase = createClient()
  const params = useParams()
  const materialId = params.id as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [material, setMaterial] = useState<MaterialInfo | null>(null)
  const [period, setPeriod] = useState<7 | 30 | 90>(30)

  // Данные за выбранный период
  const [viewsSeries, setViewsSeries] = useState<number[]>([])
  const [purchasesSeries, setPurchasesSeries] = useState<number[]>([])
  const [likesSeries, setLikesSeries] = useState<number[]>([])
  const [favoritesSeries, setFavoritesSeries] = useState<number[]>([])
  const [sources, setSources] = useState<Record<string, number>>({})
  const [sourceSeries, setSourceSeries] = useState<Record<string, number[]>>({})
  const [salesCount, setSalesCount] = useState(0)
  const [salesAmount, setSalesAmount] = useState(0)
  const [salesEarnings, setSalesEarnings] = useState(0)
  const [social, setSocial] = useState({ likes: 0, favorites: 0 })
  const [started, setStarted] = useState(0) // начали читать (lesson_progress)
  const [completed, setCompleted] = useState(0)
  const [startedSeries, setStartedSeries] = useState<number[]>([])
  const [completedSeries, setCompletedSeries] = useState<number[]>([])
  // Каталог: показы карточки на главной + клики (CTR)
  const [catalog, setCatalog] = useState({ impressions: 0, clicks: 0 })

  // День под курсором на каждом из графиков — для строки-подписи над графиком
  const [hoverViews, setHoverViews] = useState<number | null>(null)
  const [hoverReactions, setHoverReactions] = useState<number | null>(null)
  const [hoverSources, setHoverSources] = useState<number | null>(null)
  const [hoverEngage, setHoverEngage] = useState<number | null>(null)

  // Скрытые линии на графиках (клик по легенде). Ключ — id линии/источника
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})
  const [hiddenReactions, setHiddenReactions] = useState<Record<string, boolean>>({})
  const [hiddenSources, setHiddenSources] = useState<Record<string, boolean>>({})

  // Клик по легенде: скрыть/показать линию. Последнюю видимую не прячем —
  // иначе график останется пустым (allKeys — все ключи этого графика)
  const toggleSeries = (
    map: Record<string, boolean>,
    setter: (m: Record<string, boolean>) => void,
    key: string,
    allKeys: string[],
  ) => {
    const othersVisible = allKeys.some(k => k !== key && !map[k])
    if (!map[key] && !othersVisible) return
    setter({ ...map, [key]: !map[key] })
  }

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/login')
        return
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!coachData) {
        redirect('/dashboard/mentor')
        return
      }

      // Материал — урок или курс: ищем в обеих таблицах и проверяем владельца
      let mat: MaterialInfo | null = null
      const { data: lesson } = await supabase
        .from('lessons')
        .select('id, title, price, cover_image, created_at, coach_id')
        .eq('id', materialId)
        .maybeSingle()
      if (lesson && lesson.coach_id === coachData.id) {
        mat = { id: lesson.id, type: 'lesson', title: lesson.title, price: Number(lesson.price || 0), cover: lesson.cover_image, created_at: lesson.created_at }
      } else {
        const { data: course } = await supabase
          .from('courses')
          .select('id, title, price, cover_image, cover_image_url, created_at, coach_id')
          .eq('id', materialId)
          .maybeSingle()
        if (course && course.coach_id === coachData.id) {
          mat = { id: course.id, type: 'course', title: course.title, price: Number(course.price || 0), cover: course.cover_image || course.cover_image_url, created_at: course.created_at }
        }
      }
      if (!mat) {
        setNotFound(true)
        return
      }
      setMaterial(mat)

      const now = new Date()
      const periodStart = new Date(now.getTime() - period * 86400000)

      // Метки дней: индекс 0 = (period-1) дней назад … последний = сегодня
      const dayLabels = Array.from({ length: period }, (_, i) =>
        new Date(now.getTime() - (period - 1 - i) * 86400000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      )

      // Охваты: события просмотра страницы материала (включая гостей).
      // Фильтр по типу события обязателен: показы/клики каталога (CTR)
      // живут в этой же таблице и в охват страниц входить не должны.
      const { data: viewsData } = await supabase
        .from('analytics_events')
        .select('created_at, metadata')
        .eq('event_type', 'lesson_view')
        .eq('target_type', mat.type)
        .eq('target_id', mat.id)
        .gte('created_at', periodStart.toISOString())

      // Каталог: показы карточки на главной и клики по ней (CTR)
      const { data: catalogData } = await supabase
        .from('analytics_events')
        .select('event_type')
        .eq('target_type', mat.type)
        .eq('target_id', mat.id)
        .in('event_type', ['catalog_impression', 'catalog_click'])
        .gte('created_at', periodStart.toISOString())
      const catImpressions = (catalogData || []).filter((e: any) => e.event_type === 'catalog_impression').length
      const catClicks = (catalogData || []).filter((e: any) => e.event_type === 'catalog_click').length
      setCatalog({ impressions: catImpressions, clicks: catClicks })

      const vSeries = new Array(period).fill(0)
      const srcCounts: Record<string, number> = {}
      const srcSeries: Record<string, number[]> = {}
      for (const ev of viewsData || []) {
        const dayIndex = period - 1 - Math.floor((now.getTime() - new Date(ev.created_at).getTime()) / 86400000)
        if (dayIndex >= 0 && dayIndex < period) vSeries[dayIndex]++
        const src = (ev.metadata as any)?.source || 'direct'
        srcCounts[src] = (srcCounts[src] || 0) + 1
        if (!srcSeries[src]) srcSeries[src] = new Array(period).fill(0)
        if (dayIndex >= 0 && dayIndex < period) srcSeries[src][dayIndex]++
      }
      setViewsSeries(vSeries)
      setSourceSeries(srcSeries)
      setSources(Object.fromEntries(Object.entries(srcCounts).sort((a, b) => b[1] - a[1])))

      // Продажи: покупки материала (только оплаченные; RLS отбирает свои)
      const { data: purchases } = await supabase
        .from('purchases')
        .select('amount, coach_earnings, payment_status, purchased_at')
        .eq(mat.type === 'lesson' ? 'lesson_id' : 'course_id', mat.id)
        .eq('payment_status', 'completed')

      const pSeries = new Array(period).fill(0)
      let count = 0
      let amount = 0
      let earnings = 0
      for (const p of purchases || []) {
        if (new Date(p.purchased_at) < periodStart) continue
        count++
        amount += Number(p.amount || 0)
        earnings += Number(p.coach_earnings ?? p.amount ?? 0)
        const dayIndex = period - 1 - Math.floor((now.getTime() - new Date(p.purchased_at).getTime()) / 86400000)
        if (dayIndex >= 0 && dayIndex < period) pSeries[dayIndex]++
      }
      setPurchasesSeries(pSeries)
      setSalesCount(count)
      setSalesAmount(amount)
      setSalesEarnings(earnings)

      // Реакции по дням: лайки (только у уроков — на курсах лайков нет)
      // и добавления в избранное (и у уроков, и у курсов). Читаем через
      // SQL-функцию get_social_series (security definer): RLS таблицы
      // favorites не даёт автору читать чужие строки даже на своих материалах.
      const lSeries = new Array(period).fill(0)
      const fSeries = new Array(period).fill(0)
      const { data: seriesData } = await supabase.rpc('get_social_series', {
        p_lesson_id: mat.type === 'lesson' ? mat.id : null,
        p_course_id: mat.type === 'course' ? mat.id : null,
      })
      for (const row of seriesData || []) {
        const dayIndex = period - 1 - Math.floor((now.getTime() - new Date(row.day).getTime()) / 86400000)
        if (dayIndex >= 0 && dayIndex < period) {
          if (row.kind === 'like') lSeries[dayIndex] += Number(row.cnt)
          else fSeries[dayIndex] += Number(row.cnt)
        }
      }
      setLikesSeries(lSeries)
      setFavoritesSeries(fSeries)

      // Реакции и вовлечённость
      // Вовлечённость: прогресс учеников (lesson_progress) — итоги за всё
      // время + серии по дням (started_at / completed_at)
      const stSeries = new Array(period).fill(0)
      const cpSeries = new Array(period).fill(0)
      const bucketProgress = (rows: any[]) => {
        for (const p of rows || []) {
          if (p.started_at) {
            const di = period - 1 - Math.floor((now.getTime() - new Date(p.started_at).getTime()) / 86400000)
            if (di >= 0 && di < period) stSeries[di]++
          }
          if (p.completed_at) {
            const di = period - 1 - Math.floor((now.getTime() - new Date(p.completed_at).getTime()) / 86400000)
            if (di >= 0 && di < period) cpSeries[di]++
          }
        }
      }
      if (mat.type === 'lesson') {
        const { data: socialData } = await supabase.rpc('get_lesson_social_counts', { p_lesson_ids: [mat.id] })
        const s = (socialData || [])[0]
        setSocial({ likes: s?.likes || 0, favorites: s?.favorites || 0 })

        const { data: progress } = await supabase
          .from('lesson_progress')
          .select('status, started_at, completed_at')
          .eq('lesson_id', mat.id)
        bucketProgress(progress || [])
        setStarted(progress?.length || 0)
        setCompleted(progress?.filter((p: any) => p.status === 'completed').length || 0)
      } else {
        // Курс: вовлечённость — по его урокам, реакции на курс не ставят
        const { data: links } = await supabase
          .from('course_lessons')
          .select('lesson_id')
          .eq('course_id', mat.id)
        const ids = (links || []).map((l: any) => l.lesson_id)
        if (ids.length > 0) {
          const { data: progress } = await supabase
            .from('lesson_progress')
            .select('status, started_at, completed_at')
            .in('lesson_id', ids)
          bucketProgress(progress || [])
          setStarted(progress?.length || 0)
          setCompleted(progress?.filter((p: any) => p.status === 'completed').length || 0)
        } else {
          setStarted(0)
          setCompleted(0)
        }
        setSocial({ likes: 0, favorites: 0 })
      }
      setStartedSeries(stSeries)
      setCompletedSeries(cpSeries)
    } catch (error) {
      console.error('Error loading material analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalViews = viewsSeries.reduce((a, b) => a + b, 0)

  if (notFound || (!loading && !material)) {
    return (
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
        <MentorSectionNav className="mb-6" />
        <Card variant="glow" padding="none" className="p-12 text-center">
          <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Материал не найден</h1>
          <p className="text-gray-600 mb-6">Возможно, он удалён или принадлежит другому автору</p>
          <Link href="/mentor/analytics" className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold inline-block">
            ← Аналитика
          </Link>
        </Card>
      </main>
    )
  }

  if (loading || !material) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  const isCourse = material.type === 'course'
  const conversion = totalViews > 0 ? Math.round((salesCount / totalViews) * 100) : 0

  // Источники для графика: сортировка «от большего», цвет по порядку
  const sourceStack = Object.entries(sources)
    .map(([src, total], i) => ({
      label: src,
      total,
      color: SRC_COLORS[i % SRC_COLORS.length],
      values: sourceSeries[src] || new Array(period).fill(0),
    }))
    .sort((a, b) => b.total - a.total)

  // Источники, не скрытые кликом по легенде
  const visibleStack = sourceStack.filter(s => !hiddenSources[s.label])

  // Суммы реакций за период (для кольцевой диаграммы и итогов)
  const likesTotal = likesSeries.reduce((a, b) => a + b, 0)
  const favoritesTotal = favoritesSeries.reduce((a, b) => a + b, 0)

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      <MentorSectionNav className="mb-6" />

      {/* Заголовок + переход назад */}
      <div className="mb-6">
        <Link href="/mentor/analytics" className="text-purple-600 hover:text-purple-700 text-sm font-medium">
          ← Аналитика
        </Link>
        <div className="flex items-start gap-4 mt-2">
          <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex-shrink-0 hidden sm:flex items-center justify-center">
            {material.cover ? (
              <Image src={material.cover} alt={material.title} fill sizes="64px" className="w-full h-full object-cover" />
            ) : isCourse ? (
              <BookOpen className="h-6 w-6 text-white opacity-60" strokeWidth={1.5} />
            ) : (
              <FileText className="h-6 w-6 text-white opacity-60" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text break-words">{material.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              <span className={isCourse ? 'text-blue-600 font-medium' : ''}>{isCourse ? 'Курс' : 'Урок'}</span>
              {' · '}опубликован {new Date(material.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}
              {Number(material.price) === 0 ? 'бесплатный' : `${material.price} ₽`}
            </p>
          </div>
        </div>
      </div>

      {/* Переключатель периода */}
      <div className="mb-6 inline-flex bg-purple-50 rounded-xl p-1 gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPeriod(p.days)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.days
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Сводные цифры за период */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Eye className="h-5 w-5" strokeWidth={2} /></span>
            <div>
              <div className="text-xl font-bold gradient-text">{totalViews}</div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                Просмотров (охват)
                <Hint text="Сколько раз страницу материала открыли за период, включая неавторизованных читателей из соцсетей и поиска." />
              </div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ShoppingCart className="h-5 w-5" strokeWidth={2} /></span>
            <div>
              <div className="text-xl font-bold text-emerald-600">{salesCount}</div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                Покупок
                <Hint text="Сколько раз материал оплатили за период. Покупка засчитывается после подтверждения платежа платёжной системой." />
              </div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Wallet className="h-5 w-5" strokeWidth={2} /></span>
            <div>
              <div className="text-xl font-bold text-blue-600">{money(salesEarnings)}</div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                На руки за период
                <Hint text="Ваша выручка за период после удержания комиссии платформы — то, что реально придёт на выплату." />
              </div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Target className="h-5 w-5" strokeWidth={2} /></span>
            <div>
              <div className="text-xl font-bold text-amber-600">{conversion}%</div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                Просмотр → покупка
                <Hint text="Доля посетителей страницы, которые купили материал. Мало покупок при хороших просмотрах — повод доработать описание, обложку или цену." />
              </div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><MousePointerClick className="h-5 w-5" strokeWidth={2} /></span>
            <div>
              <div className="text-xl font-bold text-indigo-600">{catalog.impressions}</div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <span>Показов в каталоге · CTR {catalog.impressions > 0 ? `${(catalog.clicks / catalog.impressions * 100).toFixed(1).replace('.', ',')}%` : '—'}</span>
                <Hint text="Сколько раз карточку материала показали на главной за период. CTR — доля показов, закончившихся кликом: растёт, когда обложка и название цепляют. Показ считается один раз за сессию." />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* График по дням: просмотры (фиолетовый) + покупки (зелёный внутри) */}
      <Card variant="glow" padding="none" className="p-6 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          По дням за период
          <Hint text="Просмотры страницы и покупки по дням. Замечаете пики — смотрите, что публиковали в тот день, и повторяйте это." />
        </h2>

        {/* Подпись под курсором: значение + пояснение (вместо всплывающего тултипа) */}
        <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
          {hoverViews === null ? (
            <span className="text-gray-400">Наведите курсор на график — покажу цифры за этот день</span>
          ) : (
            <>
              <b className="text-gray-900">{dayLabel(hoverViews, period)}</b>
              {' — '}{viewsSeries[hoverViews]} {plural(viewsSeries[hoverViews], 'просмотр', 'просмотра', 'просмотров')} страницы материала, включая неавторизованных читателей
              {purchasesSeries[hoverViews] > 0 && (
                <>, купили {purchasesSeries[hoverViews]} {plural(purchasesSeries[hoverViews], 'раз', 'раза', 'раз')}</>
              )}
            </>
          )}
        </p>

        {totalViews + salesCount > 0 ? (
          <div>
            {/* Легенда: клик по пункту скрывает/показывает линию */}
            <div className="flex flex-wrap items-center gap-1 mb-4">
              <LegendToggle
                label="Просмотры"
                color="#7c3aed"
                hidden={!!hiddenLines.views}
                onClick={() => toggleSeries(hiddenLines, setHiddenLines, 'views', ['views', 'sales'])}
              />
              <LegendToggle
                label="Покупки"
                color="#10b981"
                hidden={!!hiddenLines.sales}
                onClick={() => toggleSeries(hiddenLines, setHiddenLines, 'sales', ['views', 'sales'])}
              />
            </div>

            <LineChart
              period={period}
              hover={hoverViews}
              onHover={setHoverViews}
              series={[
                ...(hiddenLines.views ? [] : [{ key: 'views', color: '#7c3aed', values: viewsSeries }]),
                ...(hiddenLines.sales ? [] : [{ key: 'sales', color: '#10b981', values: purchasesSeries }]),
              ]}
            />

            {/* Итого по дням */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 pt-4 border-t border-purple-100 mt-4 text-sm text-gray-600">
              <span>Всего просмотров: <b className="text-gray-900">{totalViews}</b></span>
              <span>Всего покупок: <b className="text-gray-900">{salesCount}</b></span>
              <span>Оплачено за период: <b className="text-gray-900">{money(salesAmount)}</b></span>
            </div>

            {/* Кольцевая диаграмма: конверсия просмотра в покупку */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-4 pt-4 border-t border-purple-100">
              <DonutChart
                segments={[
                  { color: '#10b981', value: salesCount },
                  { color: '#c4b5fd', value: Math.max(0, totalViews - salesCount) },
                ]}
                center={`${conversion}%`}
                sub="конверсия"
              />
              <div className="w-full space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 text-gray-600">
                    <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                    Купили после просмотра
                  </span>
                  <b className="text-emerald-600">{salesCount}</b>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 text-gray-600">
                    <span className="h-3 w-3 rounded-full bg-purple-300"></span>
                    Смотрели без покупки
                  </span>
                  <b className="text-purple-600">{Math.max(0, totalViews - salesCount)}</b>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center">
            <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
            <p className="text-gray-600 mb-2">За выбранный период событий не было</p>
            <p className="text-sm text-gray-500">
              Попробуйте другой период или поделитесь ссылкой на материал (гостевые просмотры считаются с 16.09)
            </p>
          </div>
        )}
      </Card>

      {/* Реакции по дням: лайки (красный) + избранное (янтарный). Для курса
          лайков не существует — показываем только избранное */}
      <Card variant="glow" padding="none" className="p-6 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          Реакции по дням
          <Hint text="Лайки и добавления в избранное показывают, что материал отзывается. Много просмотров при нулевых реакциях — контент не оправдал ожидание от заголовка." />
        </h2>

        {/* Подпись под курсором: значение + пояснение */}
        <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
          {hoverReactions === null ? (
            <span className="text-gray-400">Наведите курсор на график — покажу цифры за этот день</span>
          ) : (
            <>
              <b className="text-gray-900">{dayLabel(hoverReactions, period)}</b>
              {' — '}
              {!isCourse && <>лайков: {likesSeries[hoverReactions] || 0}, </>}
              добавили в избранное: {favoritesSeries[hoverReactions] || 0} (реакции читателей на материал)
            </>
          )}
        </p>

        {likesSeries.some(v => v > 0) || favoritesSeries.some(v => v > 0) ? (
          <div>
            {/* Легенда: клик по пункту скрывает/показывает линию */}
            <div className="flex flex-wrap items-center gap-1 mb-4">
              {!isCourse && (
                <LegendToggle
                  label="Лайки"
                  color="#ef4444"
                  hidden={!!hiddenReactions.likes}
                  onClick={() => toggleSeries(hiddenReactions, setHiddenReactions, 'likes', ['likes', 'favorites'])}
                />
              )}
              <LegendToggle
                label="В избранном"
                color="#f59e0b"
                hidden={!!hiddenReactions.favorites}
                onClick={() => toggleSeries(hiddenReactions, setHiddenReactions, 'favorites', isCourse ? ['favorites'] : ['likes', 'favorites'])}
              />
            </div>

            <LineChart
              period={period}
              hover={hoverReactions}
              onHover={setHoverReactions}
              series={[
                ...(!isCourse && !hiddenReactions.likes ? [{ key: 'likes', color: '#ef4444', values: likesSeries }] : []),
                ...(hiddenReactions.favorites ? [] : [{ key: 'favorites', color: '#f59e0b', values: favoritesSeries }]),
              ]}
            />

            {/* Кольцевая диаграмма: доля реакций */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-4 pt-4 border-t border-purple-100">
              <DonutChart
                segments={[
                  ...(!isCourse ? [{ color: '#ef4444', value: likesTotal }] : []),
                  { color: '#f59e0b', value: favoritesTotal },
                ]}
                center={String(likesTotal + favoritesTotal)}
                sub={plural(likesTotal + favoritesTotal, 'реакция', 'реакции', 'реакций')}
              />
              <div className="w-full space-y-2 text-sm">
                {!isCourse && (
                  <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 text-gray-600">
                      <span className="h-3 w-3 rounded-full bg-red-500"></span>
                      Лайки
                    </span>
                    <b className="text-red-600">{likesTotal}</b>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 text-gray-600">
                    <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                    В избранном
                  </span>
                  <b className="text-amber-500">{favoritesTotal}</b>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-red-50 to-amber-50 rounded-xl p-8 text-center">
            <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
            <p className="text-gray-600 mb-2">За выбранный период реакций не было</p>
            <p className="text-sm text-gray-500">
              Лайки и добавления в избранное появятся здесь, как только читатели начнут реагировать
            </p>
          </div>
        )}
      </Card>

      {/* Источники переходов — на всю ширину (график по общим правилам) */}
      <div className="mb-8">
        <Card variant="glow" padding="none" className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            Откуда приходят читатели
            <Hint text="Откуда переходы: соцсети и мессенджеры видны по меткам utm в ссылках, остальное — по ссылающейся странице. Помогает понять, какую площадку стоит развивать." />
          </h2>

          {/* Подпись под курсором: значение + пояснение */}
          <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
            {hoverSources === null ? (
              <span className="text-gray-400">Наведите курсор на столбец — покажу цифры за этот день</span>
            ) : (
              <>
                <b className="text-gray-900">{dayLabel(hoverSources, period)}</b>
                {' — '}
                {visibleStack.reduce((a, s) => a + (s.values[hoverSources] || 0), 0)}{' '}
                {plural(visibleStack.reduce((a, s) => a + (s.values[hoverSources] || 0), 0), 'переход', 'перехода', 'переходов')} на материал
                {visibleStack.some(s => (s.values[hoverSources] || 0) > 0) && (
                  <>: {visibleStack.filter(s => (s.values[hoverSources] || 0) > 0).map(s => `${sourceLabel(s.label)} — ${s.values[hoverSources]}`).join(', ')}</>
                )}
              </>
            )}
          </p>

          {Object.keys(sources).length > 0 && visibleStack.length > 0 ? (
            <SourceStack
              stack={visibleStack}
              max={chartMaxSafe(...visibleStack.map(s => s.values))}
              onHover={setHoverSources}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Пока нет переходов за период. Делитесь ссылкой с меткой utm_source (telegram, dzen, vk…) — источник появится здесь.
            </p>
          )}

          {/* Кольцевая диаграмма долей + легенда-переключатели: клик по строке
              скрывает/показывает источник на графике и в диаграмме */}
          {sourceStack.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-4 border-t border-purple-100 mt-4">
              <DonutChart
                segments={visibleStack.map(s => ({ color: s.color, value: s.total }))}
                center={String(visibleStack.reduce((a, s) => a + s.total, 0))}
                sub={plural(visibleStack.reduce((a, s) => a + s.total, 0), 'переход', 'перехода', 'переходов')}
              />
              <div className="w-full space-y-2">
                {sourceStack.map(s => {
                  const visTotal = visibleStack.reduce((a, x) => a + x.total, 0)
                  const share = !hiddenSources[s.label] && visTotal > 0 ? Math.round((s.total / visTotal) * 100) : null
                  return (
                    <button
                      key={s.label}
                      onClick={() => toggleSeries(hiddenSources, setHiddenSources, s.label, sourceStack.map(x => x.label))}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-2 text-sm transition-all hover:opacity-80 ${hiddenSources[s.label] ? 'opacity-40' : ''}`}
                      style={{ backgroundColor: `${s.color}14` }}
                    >
                      <span className="inline-flex items-center gap-2 text-gray-600">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                        {sourceLabel(s.label)}
                      </span>
                      <span className="text-gray-700">
                        {share !== null && <b className="mr-2">{share}%</b>}
                        <b>{s.total}</b>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {sourceStack.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Нажмите на источник, чтобы показать его отдельно или в комбинации с другими
            </p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Источник: метка utm_source в ссылке, иначе страница, с которой пришёл читатель, иначе «Прямая».
          </p>
        </Card>

        <Card variant="glow" padding="none" className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            Вовлечённость учеников
            <Hint text="Сколько зарегистрированных учеников начали читать и сколько дочитали до конца. Дочитывание — главный сигнал качества содержания." />
          </h2>

          {/* Подпись под курсором: значение + пояснение */}
          <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
            {hoverEngage === null ? (
              <span className="text-gray-400">Наведите курсор на столбец — покажу цифры за этот день</span>
            ) : (
              <>
                <b className="text-gray-900">{dayLabel(hoverEngage, period)}</b>
                {' — '}начали читать: {startedSeries[hoverEngage] || 0}, завершили: {completedSeries[hoverEngage] || 0} (прогресс отмечают авторизованные ученики)
              </>
            )}
          </p>

          {startedSeries.some(v => v > 0) || completedSeries.some(v => v > 0) ? (
            <div>
              {/* Легенда */}
              <div className="flex items-center gap-6 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                  <span className="text-gray-600">Начали читать</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                  <span className="text-gray-600">Завершили</span>
                </div>
              </div>

              <div className="relative flex items-end gap-1 h-64 pb-8 overflow-x-auto" onMouseLeave={() => setHoverEngage(null)}>
                <DayBars
                  views={startedSeries}
                  purchases={completedSeries}
                  max={chartMaxSafe(startedSeries, completedSeries)}
                  onHover={setHoverEngage}
                />
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center">
              <div className="mb-4 flex justify-center"><Inbox className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
              <p className="text-gray-600 mb-2">За выбранный период чтений не было</p>
              <p className="text-sm text-gray-500">Прогресс отмечают авторизованные ученики, когда открывают материал</p>
            </div>
          )}

          {/* Итоги за всё время: кольцевая диаграмма дочитывания */}
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-6 pt-6 border-t border-purple-100">
            <DonutChart
              segments={[
                { color: '#10b981', value: completed },
                { color: '#c4b5fd', value: Math.max(0, started - completed) },
              ]}
              center={`${started > 0 ? Math.round((completed / started) * 100) : 0}%`}
              sub="дочитали"
            />
            <div className="w-full space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                  Завершили
                </span>
                <b className="text-emerald-600">{completed}</b>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-purple-50 py-2.5 px-4">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <span className="h-3 w-3 rounded-full bg-purple-300"></span>
                  Начали, но не дочитали
                </span>
                <b className="text-purple-600">{Math.max(0, started - completed)}</b>
              </div>
              <div className="flex items-center justify-between px-4 py-1 text-xs text-gray-500">
                <span>Всего начали читать</span>
                <b className="text-gray-700">{started}</b>
              </div>
            </div>
          </div>
          {!isCourse && (
            <div className="flex items-center gap-6 mt-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-red-600" title="Лайки">
                <Heart className="h-4 w-4" fill="currentColor" />
                {social.likes} лайков
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-500" title="В избранном">
                <Star className="h-4 w-4" fill="currentColor" />
                {social.favorites} в избранном
              </span>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}

// Максимум оси Y для графика (округление вверх до «красивого» шага)
function chartMaxSafe(...series: number[][]) {
  const raw = Math.max(1, ...series.flat())
  const step = Math.pow(10, Math.floor(Math.log10(raw)))
  return Math.ceil(raw / step) * step
}

// Палитра цветов для источников переходов (назначается по порядку «от большего»)
const SRC_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#6b7280']

// Столбцы с накоплением по дням: каждый день — стопка сегментов,
// один цвет = один источник перехода. Крупнейший источник — внизу столбца.
function SourceStack({ stack, max, onHover }: {
  stack: { label: string; total: number; values: number[]; color: string }[]
  max: number
  onHover?: (idx: number | null) => void
}) {
  const days = stack[0]?.values.length || 0
  const ordered = [...stack].sort((a, b) => b.total - a.total)
  return (
    <div>
      <div className="relative flex items-end gap-1 h-56 pb-8 overflow-x-auto" onMouseLeave={() => onHover?.(null)}>
        {Array.from({ length: days }, (_, idx) => {
          const dayDate = new Date(Date.now() - (days - 1 - idx) * 86400000)
          const dayTotal = stack.reduce((a, s) => a + (s.values[idx] || 0), 0)
          const daySources = ordered.filter(s => (s.values[idx] || 0) > 0)
          return (
            <div
              key={idx}
              className="flex-1 min-w-[14px] flex flex-col items-center group relative cursor-pointer"
              onMouseEnter={() => onHover?.(idx)}
            >
              <div className="w-full flex flex-col justify-end h-48">
                {[...ordered].reverse().map(s => {
                  const v = s.values[idx] || 0
                  if (v === 0) return null
                  return (
                    <div
                      key={s.label}
                      className="w-full transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max((v / max) * 100, 2)}%`, backgroundColor: s.color }}
                    ></div>
                  )
                })}
              </div>

              <div className="text-[10px] text-gray-500 mt-2 absolute -bottom-6 whitespace-nowrap">
                {dayDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Кнопка легенды: клик скрывает/показывает линию (или источник) на графике
function LegendToggle({ label, color, hidden, onClick }: {
  label: string
  color: string
  hidden: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-gray-600 transition-all hover:bg-purple-50 ${hidden ? 'opacity-40' : ''}`}
    >
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }}></span>
      {label}
    </button>
  )
}

// Кольцевая диаграмма («пончик»): доли нескольких сегментов. Каждый сегмент —
// своя окружность со смещением по кругу (rotate). В центре — главный
// показатель (процент или сумма)
function DonutChart({ segments, center, sub, track = '#ede9fe' }: {
  segments: { color: string; value: number }[]
  center: string
  sub: string
  track?: string
}) {
  const R = 52
  const C = 2 * Math.PI * R // длина окружности
  const total = segments.reduce((a, s) => a + s.value, 0)
  const visibleCount = segments.filter(s => s.value > 0).length
  let acc = 0 // пройденная доля круга (для стартового угла следующего сегмента)
  return (
    <div className="relative shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke={track} strokeWidth="16" />
        {total > 0 && segments.map((s, i) => {
          if (s.value <= 0) return null
          const len = (s.value / total) * C
          const rot = -90 + (acc / total) * 360
          acc += s.value
          return (
            <circle
              key={i}
              cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeLinecap={visibleCount > 1 ? 'butt' : 'round'}
              strokeDasharray={`${len} ${C - len}`}
              transform={`rotate(${rot} 70 70)`}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{center}</span>
        <span className="text-[11px] text-gray-500">{sub}</span>
      </div>
    </div>
  )
}

// Линейный график по дням: несколько серий-линий, сетка, оси, вертикальная
// линия-указатель под курсором. Родитель решает, какие серии передавать —
// скрытые кликом по легенде сюда просто не попадают
function LineChart({ series, period, hover, onHover, height = 220 }: {
  series: { key: string; color: string; values: number[] }[]
  period: number
  hover: number | null
  onHover: (idx: number | null) => void
  height?: number
}) {
  const W = 640
  const H = height
  const PAD_T = 10          // отступ сверху до первой линии сетки
  const BASE = H - 20       // базовая линия (ось нуля)
  const PLOT = BASE - PAD_T // высота поля значений
  const n = series[0]?.values.length || 0
  const peak = Math.max(1, ...series.flatMap(s => s.values))
  const step = niceStep(peak / 4)
  const top = step * 4
  const x = (i: number) => (i * W) / Math.max(1, n - 1)
  const y = (v: number) => BASE - (v / top) * PLOT
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
          {/* вертикальная линия-указатель под курсором */}
          {hover !== null && n > 1 && (
            <line x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={BASE} stroke="#c4b5fd" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
          {/* линии серий */}
          {series.map(s => (
            <path
              key={s.key}
              d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* невидимые зоны наведения по дням */}
          {Array.from({ length: n }, (_, i) => (
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
    </div>
  )
}

// Столбцы графика: просмотры по дням, покупки — зелёная вставка внутри
function DayBars({ views, purchases, max, onHover }: {
  views: number[]
  purchases: number[]
  max: number
  onHover?: (idx: number | null) => void
}) {
  return (
    <>
      {views.map((v, idx) => {
        const bought = purchases[idx]
        const height = (v / max) * 100
        const boughtHeight = v > 0 ? (bought / v) * height : 0
        const dayDate = new Date(Date.now() - (views.length - 1 - idx) * 86400000)
        return (
          <div
            key={idx}
            className="flex-1 min-w-[14px] flex flex-col items-center group relative cursor-pointer"
            onMouseEnter={() => onHover?.(idx)}
          >
            <div className="w-full flex flex-col items-center justify-end h-56">
              <div
                className="w-full bg-gradient-to-t from-purple-500 to-blue-500 rounded-t-sm relative transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(height, v > 0 ? 2 : 0)}%` }}
              >
                {bought > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-emerald-500"
                    style={{ height: `${Math.min(100, boughtHeight)}%` }}
                  ></div>
                )}
                {v > 0 && (
                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs font-bold text-purple-700">
                    {v}
                  </div>
                )}
              </div>
            </div>

            <div className="text-[10px] text-gray-500 mt-2 absolute -bottom-6 whitespace-nowrap">
              {dayDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
            </div>
          </div>
        )
      })}
    </>
  )
}