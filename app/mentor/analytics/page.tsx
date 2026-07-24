import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MentorAnalyticsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Получаем данные ментора
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('user_id', user.id)
    .single()

  if (!coach) {
    redirect('/dashboard/mentor')
  }

  // Получаем все уроки ментора
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('coach_id', coach.id)

  const lessonIds = lessons?.map((l: any) => l.id) || []

  // Общая статистика
  const { count: totalLessons } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id)

  const { count: totalCourses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id)

  // Просмотры за всё время
  const { count: totalViews } = await supabase
    .from('analytics_events')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', 'lesson')
    .in('target_id', lessonIds)

  // Топ уроки по просмотрам (считаем вручную)
  const { data: allViews } = await supabase
    .from('analytics_events')
    .select('target_id')
    .eq('event_type', 'lesson_view')
    .in('target_id', lessonIds)

  // Группируем просмотры по урокам
  const viewsCount: Record<string, number> = {}
  allViews?.forEach((view: any) => {
    viewsCount[view.target_id] = (viewsCount[view.target_id] || 0) + 1
  })

  // Сортируем и берем топ-5
  const topLessons = Object.entries(viewsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([target_id, count]) => ({ target_id, count }))

  // Недавняя активность
  const { data: recentActivity } = await supabase
    .from('analytics_events')
    .select(`
      event_type,
      created_at,
      target_id
    `)
    .in('target_id', lessonIds)
    .order('created_at', { ascending: false })
    .limit(10)

  // Доход
  const { data: revenueData } = await supabase
    .from('purchases')
    .select('amount')
    .in('lesson_id', lessonIds)
    .eq('payment_status', 'completed')

  const totalRevenue = revenueData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <Link href="/dashboard/mentor" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group mb-2">
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад в кабинет
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
              Моя статистика
            </h1>
            <p className="text-gray-600 mt-2">
              Просмотры, конверсия, рейтинг и активность
            </p>
          </div>
          
          <div className="flex gap-2">
            <button className="bg-white text-purple-700 border border-purple-200 px-4 py-2 rounded-xl font-semibold hover:bg-purple-50 transition-all text-sm">
              📥 Экспорт
            </button>
          </div>
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="style-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              👁️
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {totalViews || 0}
          </div>
          <div className="text-sm text-gray-600">Всего просмотров</div>
        </div>

        <div className="style-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              📚
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+3</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {totalLessons || 0}
          </div>
          <div className="text-sm text-gray-600">Уроков создано</div>
        </div>

        <div className="style-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              🎓
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {totalCourses || 0}
          </div>
          <div className="text-sm text-gray-600">Курсов создано</div>
        </div>

        <div className="style-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              💰
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+8%</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {totalRevenue.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-sm text-gray-600">Общий доход</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Топ уроки */}
        <div className="style-card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            Топ уроков по просмотрам
          </h2>
          
          {topLessons && topLessons.length > 0 ? (
            <div className="space-y-3">
              {topLessons.map((item: { target_id: string; count: number }, index: number) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-purple-50/30 rounded-xl border border-purple-100">
                  <div className="w-8 h-8 gradient-icon rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      Урок #{item.target_id.slice(0, 8)}...
                    </h3>
                  </div>
                  <div className="text-lg font-bold text-purple-600">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>Пока нет данных о просмотрах</p>
            </div>
          )}
        </div>

        {/* Недавняя активность */}
        <div className="style-card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Недавняя активность
          </h2>
          
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 hover:bg-purple-50/30 rounded-xl transition-colors">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {activity.event_type === 'lesson_view' && '👁️ Просмотр урока'}
                      {activity.event_type === 'course_view' && '🎓 Просмотр курса'}
                      {activity.event_type === 'lesson_purchase' && '💰 Покупка урока'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(activity.created_at).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2"></div>
              <p>Нет недавней активности</p>
            </div>
          )}
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="style-card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          Быстрые действия
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/mentor/lessons/new"
            className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                
              </div>
              <div>
                <div className="font-bold text-gray-900">Создать урок</div>
                <div className="text-sm text-gray-500">Добавить материал</div>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/mentor/courses/new"
            className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-5 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                
              </div>
              <div>
                <div className="font-bold text-gray-900">Создать курс</div>
                <div className="text-sm text-gray-500">Сформировать программу</div>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/mentor/lessons"
            className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                📚
              </div>
              <div>
                <div className="font-bold text-gray-900">Все уроки</div>
                <div className="text-sm text-gray-500">Управление</div>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/mentor"
            className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                🏠
              </div>
              <div>
                <div className="font-bold text-gray-900">Кабинет</div>
                <div className="text-sm text-gray-500">На главную</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}