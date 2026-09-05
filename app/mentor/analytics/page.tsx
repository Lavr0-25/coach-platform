'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

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

  useEffect(() => {
    loadData()
  }, [])

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

      const { count: totalCourses } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachData.id)

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

      // Статистика по каждому уроку
      const lessons = allLessons?.map(lesson => {
        const lessonProgress = allProgress?.filter(p => p.lesson_id === lesson.id) || []
        const totalLessonViews = lessonProgress.length
        const monthViews = lessonProgress.filter(p => new Date(p.started_at) >= oneMonthAgo).length
        const dayViews = lessonProgress.filter(p => new Date(p.started_at) >= oneDayAgo).length
        
        return {
          ...lesson,
          totalViews: totalLessonViews,
          monthViews,
          dayViews,
          social: socialByLesson.get(lesson.id) || { likes: 0, favorites: 0 },
        }
      }) || []

      setStats({
        totalLessons,
        totalCourses: totalCourses || 0,
        subscribers: subscribersCount,
        totalViews,
        totalCompleted,
        totalLikes: [...socialByLesson.values()].reduce((s, v) => s + v.likes, 0),
        totalFavorites: [...socialByLesson.values()].reduce((s, v) => s + v.favorites, 0),
      })

      setChartData(chart)
      setLessonsStats(lessons)
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
          Отслеживайте прогресс обучения, просмотры и активность подписчиков
        </p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card variant="glow" padding="none" className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              📚
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">{stats.totalLessons}</div>
              <div className="text-sm text-gray-600">Всего уроков</div>
            </div>
          </div>
        </Card>

        <Card variant="glow" padding="none" className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              🎓
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">{stats.totalCourses}</div>
              <div className="text-sm text-gray-600">Всего курсов</div>
            </div>
          </div>
        </Card>

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

      {/* График активности с сеткой */}
      <Card variant="glow" padding="none" className="p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📊</span>
          Активность за последние 30 дней
        </h2>
        
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
              <div className="relative flex items-end gap-1 h-64 pl-12 pb-8 overflow-x-auto">
                {chartData.map((data, idx) => {
                  const height = (data.views / (gridStep * gridLines)) * 100
                  const completedHeight = data.views > 0 ? (data.completed / data.views) * height : 0
                  
                  return (
                    <div key={idx} className="flex-1 min-w-[16px] flex flex-col items-center group relative">
                      {/* Тултип */}
                      <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                        <div className="font-semibold">{data.day}</div>
                        <div>Просмотров: {data.views}</div>
                        <div>Завершено: {data.completed}</div>
                      </div>
                      
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
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 mb-2">Пока нет данных об активности</p>
            <p className="text-sm text-gray-500">
              Когда подписчики начнут смотреть ваши уроки, здесь появится график
            </p>
          </div>
        )}
      </Card>

      {/* Таблица уроков */}
      {lessonsStats.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Все уроки</h2>
            <Link href="/dashboard/mentor/lessons" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
              Управление уроками →
            </Link>
          </div>

          <Card variant="glow" padding="none" className="overflow-hidden border border-purple-100">
            {/* Заголовок таблицы (скрыт на мобильных) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-purple-50 border-b border-purple-100 text-sm font-semibold text-gray-700">
              <div className="col-span-3">Урок</div>
              <div className="col-span-2 text-center">Всего просмотров</div>
              <div className="col-span-2 text-center">За месяц</div>
              <div className="col-span-1 text-center">За день</div>
              <div className="col-span-2 text-center">Реакции</div>
              <div className="col-span-2 text-center">Статус</div>
            </div>

            {/* Строки таблицы */}
            <div className="divide-y divide-purple-50">
              {lessonsStats.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-purple-50/50 transition-colors group"
                >
                  {/* Урок (картинка + название) */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
                      {lesson.cover_image ? (
                        <Image
                          src={lesson.cover_image}
                          alt={lesson.title}
                          fill
                          sizes="64px"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-lg opacity-50">📝</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {/* Всего просмотров */}
                  <div className="col-span-2 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold gradient-text">{lesson.totalViews}</div>
                      <div className="text-xs text-gray-500 md:hidden">Всего</div>
                    </div>
                  </div>

                  {/* За месяц */}
                  <div className="col-span-2 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{lesson.monthViews}</div>
                      <div className="text-xs text-gray-500 md:hidden">За месяц</div>
                    </div>
                  </div>

                  {/* За день */}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{lesson.dayViews}</div>
                      <div className="text-xs text-gray-500 md:hidden">За день</div>
                    </div>
                  </div>

                  {/* Реакции: лайки (сердечко) и избранное (звезда) */}
                  <div className="col-span-2 flex items-center justify-center">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600" title="Лайки">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {lesson.social.likes}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-500" title="В избранном">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        {lesson.social.favorites}
                      </span>
                    </div>
                  </div>

                  {/* Статус/Цена */}
                  <div className="col-span-2 flex items-center justify-center">
                    {lesson.is_free_preview ? (
                      <Badge variant="greenFill">
                        Бесплатно
                      </Badge>
                    ) : (
                      <span className="text-sm font-bold text-purple-700">
                        {lesson.price} ₽
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Если уроков нет */}
      {lessonsStats.length === 0 && (
        <Card variant="glow" padding="none" className="p-12 text-center mb-8">
          <div className="text-6xl mb-4">📭</div>
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
            Создать урок
          </Link>
        </Card>
      )}
    </main>
  )
}