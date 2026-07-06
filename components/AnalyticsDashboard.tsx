'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MentorStats {
  total_lessons: number
  total_views: number
  unique_viewers: number
  total_starts: number
  total_completes: number
  profile_views: number
  unique_profile_views: number
  profile_views_today: number
  avg_completion_rate: number
  total_reviews: number
  avg_rating: number
}

interface DailyView {
  view_date: string
  profile_views: number
  lesson_views: number
}

export default function AnalyticsDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState<MentorStats | null>(null)
  const [dailyData, setDailyData] = useState<DailyView[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadStats()
    }
  }, [userId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
  }

  const loadStats = async () => {
    if (!userId) return

    try {
      // Загружаем общую статистику
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_mentor_dashboard_stats', { mentor_user_id: userId })
        .single()

      if (statsError) {
        console.error('Error loading stats:', statsError)
        return
      }

      // Приводим к типу MentorStats
      setStats(statsData as MentorStats)

      // Загружаем данные по дням
      const { data: dailyData, error: dailyError } = await supabase
        .rpc('get_daily_views', { profile_user_id: userId, days: 30 })

      if (dailyError) {
        console.error('Error loading daily data:', dailyError)
        return
      }

      // Приводим к типу DailyView[]
      setDailyData((dailyData || []) as DailyView[])
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Статистика пока не доступна
        </h2>
        <p className="text-gray-600">
          Данные появятся, когда пользователи начнут просматривать ваши уроки
        </p>
      </div>
    )
  }

  const maxDailyViews = Math.max(
    ...dailyData.map(d => Math.max(d.profile_views, d.lesson_views)),
    1
  )

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">📊 Статистика</h2>
        <p className="text-gray-600">
          Аналитика посещений и активности за последние 30 дней
        </p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl">👁️</div>
            <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded">
              Сегодня: {stats.profile_views_today}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {stats.profile_views}
          </div>
          <div className="text-sm text-gray-600">Просмотров профиля</div>
          <div className="text-xs text-gray-500 mt-1">
            Уникальных: {stats.unique_profile_views}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
          <div className="text-3xl mb-2">📖</div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {stats.total_views}
          </div>
          <div className="text-sm text-gray-600">Просмотров уроков</div>
          <div className="text-xs text-gray-500 mt-1">
            Уникальных: {stats.unique_viewers}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {stats.total_completes}
          </div>
          <div className="text-sm text-gray-600">Завершено уроков</div>
          <div className="text-xs text-gray-500 mt-1">
            Конверсия: {stats.avg_completion_rate}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6">
          <div className="text-3xl mb-2">⭐</div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {stats.avg_rating}
          </div>
          <div className="text-sm text-gray-600">Средний рейтинг</div>
          <div className="text-xs text-gray-500 mt-1">
            Отзывов: {stats.total_reviews}
          </div>
        </div>
      </div>

      {/* Дополнительная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-3">📚 Всего уроков</h3>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {stats.total_lessons}
          </div>
          <div className="text-sm text-gray-600">
            Начато: {stats.total_starts}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-3">🎯 Конверсия</h3>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {stats.avg_completion_rate}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${stats.avg_completion_rate}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-3">👥 Уникальные посетители</h3>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {stats.unique_viewers}
          </div>
          <div className="text-sm text-gray-600">
            За последние 30 дней
          </div>
        </div>
      </div>

      {/* График просмотров */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">📈 Динамика просмотров</h3>
        
        {dailyData.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-end h-48 gap-1">
              {dailyData.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 flex-1 items-end">
                    <div
                      className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                      style={{
                        height: `${(day.profile_views / maxDailyViews) * 100}%`,
                        minHeight: day.profile_views > 0 ? '4px' : '0'
                      }}
                      title={`Профиль: ${day.profile_views}`}
                    ></div>
                    <div
                      className="flex-1 bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                      style={{
                        height: `${(day.lesson_views / maxDailyViews) * 100}%`,
                        minHeight: day.lesson_views > 0 ? '4px' : '0'
                      }}
                      title={`Уроки: ${day.lesson_views}`}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left">
                    {new Date(day.view_date).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Профиль</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="text-gray-600">Уроки</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <p>Нет данных за выбранный период</p>
          </div>
        )}
      </div>
    </div>
  )
}