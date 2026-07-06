import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('role, display_name')
    .eq('user_id', user.id)
    .single()

  if (coach?.role !== 'admin') {
    redirect('/')
  }

  // Получаем реальную статистику
  const [
    { count: activeBansCount },
    { count: newReportsCount },
    { count: usersCount },
    { count: coursesCount },
    { count: lessonsCount },
    { count: commentReportsCount },
    { count: reviewReportsCount },
    { count: totalBansCount }
  ] = await Promise.all([
    // Активные блокировки
    supabase
      .from('stop_list')
      .select('*', { count: 'exact', head: true })
      .gte('banned_until', new Date().toISOString()),
    
    // Новые жалобы за последние 24 часа (комментарии + отзывы)
    supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    
    // Всего пользователей
    supabase
      .from('coaches')
      .select('*', { count: 'exact', head: true }),
    
    // Всего курсов
    supabase
      .from('courses')
      .select('*', { count: 'exact', head: true }),
    
    // Всего уроков
    supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true }),
    
    // Жалоб на комментарии (всего)
    supabase
      .from('reports')
      .select('*', { count: 'exact', head: true }),
    
    // Жалоб на отзывы (всего)
    supabase
      .from('review_reports')
      .select('*', { count: 'exact', head: true }),
    
    // Всего блокировок (включая истёкшие)
    supabase
      .from('stop_list')
      .select('*', { count: 'exact', head: true })
  ])

  const totalNewReports = (commentReportsCount || 0) + (reviewReportsCount || 0)

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ⚙️ Админ-панель
          </h1>
          <p className="text-gray-600">
            Добро пожаловать, {coach.display_name || 'Администратор'}!
          </p>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {activeBansCount || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Активных блокировок</div>
              </div>
              <div className="text-4xl">🚫</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-600">
                  {totalNewReports || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Жалоб за 24 часа</div>
              </div>
              <div className="text-4xl">️</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600">
                  {usersCount || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Пользователей</div>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-purple-600">
                  {coursesCount || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Курсов</div>
              </div>
              <div className="text-4xl">📚</div>
            </div>
          </div>
        </div>

        {/* Дополнительная статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📖</div>
              <div>
                <div className="text-2xl font-bold text-indigo-700">{lessonsCount || 0}</div>
                <div className="text-xs text-indigo-600">Всего уроков</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">💬</div>
              <div>
                <div className="text-2xl font-bold text-orange-700">{commentReportsCount || 0}</div>
                <div className="text-xs text-orange-600">Жалоб на комментарии</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⭐</div>
              <div>
                <div className="text-2xl font-bold text-pink-700">{reviewReportsCount || 0}</div>
                <div className="text-xs text-pink-600">Жалоб на отзывы</div>
              </div>
            </div>
          </div>
        </div>

        {/* Сетка меню */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Управление</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Стоп-лист */}
          <Link
            href="/admin/stop-list"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Стоп-лист
            </h3>
            <p className="text-gray-600 text-sm">
              Управление заблокированными пользователями
            </p>
            {activeBansCount ? (
              <div className="mt-3 inline-block bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-medium">
                {activeBansCount} активных
              </div>
            ) : null}
          </Link>

          {/* Запрещённые слова */}
          <Link
            href="/admin/banned-words"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">🚫</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Запрещённые слова
            </h3>
            <p className="text-gray-600 text-sm">
              Управление списком запрещённых слов
            </p>
          </Link>

          {/* Жалобы */}
          <Link
            href="/admin/reports"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Жалобы
            </h3>
            <p className="text-gray-600 text-sm">
              Просмотр жалоб на комментарии и отзывы
            </p>
            {totalNewReports ? (
              <div className="mt-3 inline-block bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded font-medium">
                {totalNewReports} всего
              </div>
            ) : null}
          </Link>

          {/* Настройки */}
          <Link
            href="/admin/settings"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">⚙️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Настройки
            </h3>
            <p className="text-gray-600 text-sm">
              Параметры автоматической модерации
            </p>
          </Link>
        </div>
      </div>
    </main>
  )
}