'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Card } from '@/components/ui/Card'
import { Inbox } from 'lucide-react'
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

  // День под курсором на каждом из графиков — для строки-подписи над графиком
  const [hoverViews, setHoverViews] = useState<number | null>(null)
  const [hoverReactions, setHoverReactions] = useState<number | null>(null)
  const [hoverSources, setHoverSources] = useState<number | null>(null)
  const [hoverEngage, setHoverEngage] = useState<number | null>(null)

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

      // Охваты: события просмотра страницы материала (включая гостей)
      const { data: viewsData } = await supabase
        .from('analytics_events')
        .select('created_at, metadata')
        .eq('target_type', mat.type)
        .eq('target_id', mat.id)
        .gte('created_at', periodStart.toISOString())

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
            ) : (
              <span className="text-white text-lg opacity-50">{isCourse ? '📚' : '📝'}</span>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-icon rounded-xl flex items-center justify-center text-white text-xl">👁️</div>
            <div>
              <div className="text-xl font-bold gradient-text">{totalViews}</div>
              <div className="text-xs text-gray-600">Просмотров (охват)</div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">🛒</div>
            <div>
              <div className="text-xl font-bold text-emerald-600">{salesCount}</div>
              <div className="text-xs text-gray-600">Покупок</div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">💰</div>
            <div>
              <div className="text-xl font-bold text-blue-600">{money(salesEarnings)}</div>
              <div className="text-xs text-gray-600">На руки за период</div>
            </div>
          </div>
        </Card>
        <Card variant="glow" padding="none" className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl">🎯</div>
            <div>
              <div className="text-xl font-bold text-amber-600">{conversion}%</div>
              <div className="text-xs text-gray-600">Просмотр → покупка</div>
            </div>
          </div>
        </Card>
      </div>

      {/* График по дням: просмотры (фиолетовый) + покупки (зелёный внутри) */}
      <Card variant="glow" padding="none" className="p-6 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-2">По дням за период</h2>

        {/* Подпись под курсором: значение + пояснение (вместо всплывающего тултипа) */}
        <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
          {hoverViews === null ? (
            <span className="text-gray-400">Наведите курсор на столбец — покажу цифры за этот день</span>
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
            {/* Легенда */}
            <div className="flex items-center gap-6 text-sm mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                <span className="text-gray-600">Просмотры</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                <span className="text-gray-600">Покупки</span>
              </div>
            </div>

            <div className="relative flex items-end gap-1 h-64 pb-8 overflow-x-auto" onMouseLeave={() => setHoverViews(null)}>
              <DayBars
                views={viewsSeries}
                purchases={purchasesSeries}
                max={chartMaxSafe(viewsSeries, purchasesSeries)}
                onHover={setHoverViews}
              />
            </div>

            {/* Итого по дням */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 pt-4 border-t border-purple-100 mt-4 text-sm text-gray-600">
              <span>Всего просмотров: <b className="text-gray-900">{totalViews}</b></span>
              <span>Всего покупок: <b className="text-gray-900">{salesCount}</b></span>
              <span>Оплачено за период: <b className="text-gray-900">{money(salesAmount)}</b></span>
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
        <h2 className="text-lg font-bold text-gray-900 mb-2">Реакции по дням</h2>

        {/* Подпись под курсором: значение + пояснение */}
        <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
          {hoverReactions === null ? (
            <span className="text-gray-400">Наведите курсор на столбец — покажу цифры за этот день</span>
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
            {/* Легенда */}
            <div className="flex items-center gap-6 text-sm mb-4">
              {!isCourse && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">Лайки</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-400"></div>
                <span className="text-gray-600">В избранном</span>
              </div>
            </div>

            <div className="relative flex items-end gap-1 h-64 pb-8 overflow-x-auto" onMouseLeave={() => setHoverReactions(null)}>
              <ReactionBars
                likes={likesSeries}
                favorites={favoritesSeries}
                max={chartMaxSafe(likesSeries, favoritesSeries)}
                showLikes={!isCourse}
                onHover={setHoverReactions}
              />
            </div>

            {/* Итого по дням */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 pt-4 border-t border-purple-100 mt-4 text-sm text-gray-600">
              {!isCourse && (
                <span>Лайков за период: <b className="text-gray-900">{likesSeries.reduce((a, b) => a + b, 0)}</b></span>
              )}
              <span>В избранное за период: <b className="text-gray-900">{favoritesSeries.reduce((a, b) => a + b, 0)}</b></span>
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">Откуда приходят читатели</h2>

          {/* Подпись под курсором: значение + пояснение */}
          <p className="text-sm text-gray-600 mb-4 min-h-[20px]">
            {hoverSources === null ? (
              <span className="text-gray-400">Наведите курсор на столбец — покажу цифры за этот день</span>
            ) : (
              <>
                <b className="text-gray-900">{dayLabel(hoverSources, period)}</b>
                {' — '}
                {sourceStack.reduce((a, s) => a + (s.values[hoverSources] || 0), 0)}{' '}
                {plural(sourceStack.reduce((a, s) => a + (s.values[hoverSources] || 0), 0), 'переход', 'перехода', 'переходов')} на материал
                {sourceStack.some(s => (s.values[hoverSources] || 0) > 0) && (
                  <>: {sourceStack.filter(s => (s.values[hoverSources] || 0) > 0).map(s => `${sourceLabel(s.label)} — ${s.values[hoverSources]}`).join(', ')}</>
                )}
              </>
            )}
          </p>

          {Object.keys(sources).length > 0 ? (
            <SourceStack
              stack={sourceStack}
              max={chartMaxSafe(...sourceStack.map(s => s.values))}
              onHover={setHoverSources}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Пока нет переходов за период. Делитесь ссылкой с меткой utm_source (telegram, dzen, vk…) — источник появится здесь.
            </p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Источник: метка utm_source в ссылке, иначе страница, с которой пришёл читатель, иначе «Прямая».
          </p>
        </Card>

        <Card variant="glow" padding="none" className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Вовлечённость учеников</h2>

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

          {/* Итоги за всё время */}
          <div className="grid grid-cols-3 gap-3 text-center mt-6">
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-2xl font-bold gradient-text">{started}</div>
              <div className="text-xs text-gray-600 mt-1">Начали читать</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-600">{completed}</div>
              <div className="text-xs text-gray-600 mt-1">Завершили</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600">
                {started > 0 ? Math.round((completed / started) * 100) : 0}%
              </div>
              <div className="text-xs text-gray-600 mt-1">Дочитали</div>
            </div>
          </div>
          {!isCourse && (
            <div className="flex items-center gap-6 mt-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-red-600" title="Лайки">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {social.likes} лайков
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-500" title="В избранном">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
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

      {/* Легенда: цвет + источник + сумма за период */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-purple-100 mt-4">
        {ordered.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
            {sourceLabel(s.label)}: <b className="text-gray-900">{s.total}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

// Пары столбцов по дням: лайк (красный) + избранное (янтарный)
function ReactionBars({ likes, favorites, max, showLikes, onHover }: {
  likes: number[]
  favorites: number[]
  max: number
  showLikes: boolean
  onHover?: (idx: number | null) => void
}) {
  return (
    <>
      {favorites.map((f, idx) => {
        const liked = likes[idx] || 0
        const dayDate = new Date(Date.now() - (favorites.length - 1 - idx) * 86400000)
        const likeH = (liked / max) * 100
        const favH = (f / max) * 100
        return (
          <div
            key={idx}
            className="flex-1 min-w-[14px] flex flex-col items-center group relative cursor-pointer"
            onMouseEnter={() => onHover?.(idx)}
          >
            <div className="w-full flex items-end justify-center gap-0.5 h-56">
              {showLikes && (
                <div className="w-1/2 max-w-[12px] flex flex-col justify-end h-full">
                  {liked > 0 && (
                    <div className="w-full bg-red-500 rounded-t-sm" style={{ height: `${Math.max(likeH, 2)}%` }}></div>
                  )}
                </div>
              )}
              <div className="w-1/2 max-w-[12px] flex flex-col justify-end h-full">
                {f > 0 && (
                  <div className="w-full bg-amber-400 rounded-t-sm" style={{ height: `${Math.max(favH, 2)}%` }}></div>
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