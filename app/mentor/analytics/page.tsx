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

  // Получаем последние уроки
  const { data: recentLessons } = await supabase
    .from('lessons')
    .select('id, title, created_at, price, is_free_preview')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Получаем последние курсы
  const { data: recentCourses } = await supabase
    .from('courses')
    .select('id, title, created_at, price, is_published')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(5)

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
          📊 Аналитика и статистика
        </h1>
        <p className="text-gray-600">
          Отслеживайте прогресс обучения, просмотры и активность студентов
        </p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="style-card p-6">
          <div className="flex items-center gap-3 mb-3">
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
          <div className="flex items-center gap-3 mb-3">
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              👥
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">0</div>
              <div className="text-sm text-gray-600">Студентов</div>
            </div>
          </div>
        </div>

        <div className="style-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl">
              👁️
            </div>
            <div>
              <div className="text-2xl font-bold gradient-text">0</div>
              <div className="text-sm text-gray-600">Просмотров</div>
            </div>
          </div>
        </div>
      </div>

      {/* Графики активности (заглушка) */}
      <div className="style-card p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📈</span>
          Активность за последние 30 дней
        </h2>
        
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-600 mb-2">Графики активности будут доступны soon</p>
          <p className="text-sm text-gray-500">
            Здесь будут отображаться просмотры, регистрации и прогресс студентов
          </p>
        </div>
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
                  <span className="opacity-50">📝</span>
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
                  <span className="opacity-50">📚</span>
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