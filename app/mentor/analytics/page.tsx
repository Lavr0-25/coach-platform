import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('user_id', user.id)
    .single()

  if (!coach) {
    redirect('/dashboard/mentor')
  }

  // Получаем общую статистику
  const { count: totalLessons } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id)

  const { count: totalCourses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id)

  // Получаем статистику просмотров из lesson_progress
  const { data: progressData } = await supabase
    .from('lesson_progress')
    .select('lesson_id, status, started_at, completed_at')
    .in('lesson_id', 
      (await supabase.from('lessons').select('id').eq('coach_id', coach.id)).data?.map(l => l.id) || []
    )
    .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  // Подсчитываем уникальных студентов
  const { data: uniqueStudents } = await supabase
    .from('lesson_progress')
    .select('user_id', { count: 'exact', head: false })
    .in('lesson_id',
      (await supabase.from('lessons').select('id').eq('coach_id', coach.id)).data?.map(l => l.id) || []
    )

  const uniqueStudentIds = new Set(uniqueStudents?.map(p => p.user_id) || [])

  // Группируем по дням для графика
  const activityByDay: { [key: string]: { views: number; completed: number } } = {}
  progressData?.forEach(p => {
    const day = new Date(p.started_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    if (!activityByDay[day]) {
      activityByDay[day] = { views: 0, completed: 0 }
    }
    activityByDay[day].views++
    if (p.status === 'completed') {
      activityByDay[day].completed++
    }
  })

  // Последние 30 дней для графика
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }).reverse()

  const chartData = last30Days.map(day => ({
    day,
    views: activityByDay[day]?.views || 0,
    completed: activityByDay[day]?.completed || 0,
  }))

  // Получаем последние уроки
  const { data: recentLessons } = await supabase
    .from('lessons')
    .select('id, title, created_at, price, is_free_preview, cover_image')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(6)

  // Получаем последние курсы
  const { data: recentCourses } = await supabase
    .from('courses')
    .select('id, title, created_at, price, is_published, cover_image')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(6)

  const totalViews = progressData?.length || 0
  const totalCompleted = progressData?.filter(p => p.status === 'completed').length || 0

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor/profile" className="hover:text-purple-600 transition-colors">
          Личный кабинет
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Аналитика</span>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
           Аналитика и статистика
        </h1>
        <p className="text-gray-600">
          Отслеживайте прогресс обучения, просмотры и активность студентов
        </p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="style-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              📚
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">{totalLessons || 0}</div>
              <div className="text-sm text-gray-600">Всего уроков</div>
            </div>
          </div>
        </div>

        <div className="style-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              📖
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">{totalCourses || 0}</div>
              <div className="text-sm text-gray-600">Всего курсов</div>
            </div>
          </div>
        </div>

        <div className="style-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">{uniqueStudentIds.size}</div>
              <div className="text-sm text-gray-600">Студентов</div>
            </div>
          </div>
        </div>

        <div className="style-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              👁️
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">{totalViews}</div>
              <div className="text-sm text-gray-600">Просмотров</div>
            </div>
          </div>
        </div>
      </div>

      {/* График активности за последние 30 дней */}
      <div className="style-card p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"></span>
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

            {/* График */}
            <div className="relative h-64 flex items-end gap-1 overflow-x-auto pb-8">
              {chartData.map((data, idx) => {
                const maxViews = Math.max(...chartData.map(d => d.views), 1)
                const height = (data.views / maxViews) * 100
                const completedHeight = data.views > 0 ? (data.completed / data.views) * height : 0
                
                return (
                  <div key={idx} className="flex-1 min-w-[20px] flex flex-col items-center group relative">
                    {/* Тултип */}
                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {data.day}: {data.views} просм., {data.completed} заверш.
                    </div>
                    
                    {/* Столбец просмотров */}
                    <div className="w-full flex flex-col items-center justify-end h-48">
                      <div 
                        className="w-full bg-gradient-to-t from-purple-500 to-blue-500 rounded-t-sm relative"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      >
                        {/* Столбец завершённых */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-emerald-500 rounded-t-sm"
                          style={{ height: `${completedHeight}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Дата */}
                    <div className="text-xs text-gray-500 mt-2 absolute -bottom-6 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {data.day}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Итого */}
            <div className="flex items-center justify-between pt-6 border-t border-purple-100 mt-8">
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{totalViews}</div>
                <div className="text-sm text-gray-600">Всего просмотров</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{totalCompleted}</div>
                <div className="text-sm text-gray-600">Завершено уроков</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">
                  {totalViews > 0 ? Math.round((totalCompleted / totalViews) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Конверсия</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4"></div>
            <p className="text-gray-600 mb-2">Пока нет данных об активности</p>
            <p className="text-sm text-gray-500">
              Когда студенты начнут смотреть ваши уроки, здесь появится график
            </p>
          </div>
        )}
      </div>

      {/* Последние уроки */}
      {recentLessons && recentLessons.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Последние уроки</h2>
            <Link href="/dashboard/mentor/lessons" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
              Все уроки →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentLessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  {lesson.cover_image ? (
                    <img src={lesson.cover_image} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="opacity-50"></span>
                  )}
                </div>
                
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {lesson.title}
                </h3>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                  </span>
                  <span className={lesson.is_free_preview ? 'text-green-600 font-semibold' : 'text-purple-700 font-bold'}>
                    {lesson.is_free_preview ? 'Бесплатно' : `${lesson.price} ₽`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Последние курсы */}
      {recentCourses && recentCourses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Последние курсы</h2>
            <Link href="/dashboard/mentor/courses" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
              Все курсы →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentCourses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/mentor/courses/${course.id}/edit`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  {course.cover_image ? (
                    <img src={course.cover_image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="opacity-50">📚</span>
                  )}
                </div>
                
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {course.title}
                </h3>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {new Date(course.created_at).toLocaleDateString('ru-RU')}
                  </span>
                  <span className={course.price === 0 ? 'text-green-600 font-semibold' : 'text-purple-700 font-bold'}>
                    {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Если ничего нет */}
      {(!recentLessons || recentLessons.length === 0) && (!recentCourses || recentCourses.length === 0) && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Пока нет данных</h2>
          <p className="text-gray-600 mb-6">
            Создайте свой первый урок или курс, чтобы увидеть статистику
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/mentor/lessons/new"
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать урок
            </Link>
            <Link
              href="/dashboard/mentor/courses/new"
              className="bg-white text-purple-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Создать курс
            </Link>
          </div>
        </div>
      )}

      {/* Быстрые ссылки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/mentor/lessons" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
              📝
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Мои уроки</h3>
              <p className="text-sm text-gray-600">Управление уроками</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/mentor/courses" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
              📚
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Мои курсы</h3>
              <p className="text-sm text-gray-600">Управление курсами</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/mentor/profile" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
              👤
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Профиль</h3>
              <p className="text-sm text-gray-600">Настройки профиля</p>
            </div>
          </div>
        </Link>

        <Link href="/" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
              🏠
            </div>
            <div>
              <h3 className="font-bold text-gray-900">На главную</h3>
              <p className="text-sm text-gray-600">Вернуться на сайт</p>
            </div>
          </div>
        </Link>
      </div>
    </main>
  )
}