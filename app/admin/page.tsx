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
    { count: totalBansCount },
    { count: newFeedbackCount }
  ] = await Promise.all([
    // Активные блокировки
    supabase
      .from('stop_list')
      .select('*', { count: 'exact', head: true })
      .gte('banned_until', new Date().toISOString()),
    
    // Новые жалобы за последние 24 часа
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
    
    // Жалоб на комментарии
    supabase
      .from('reports')
      .select('*', { count: 'exact', head: true }),
    
    // Жалоб на отзывы
    supabase
      .from('review_reports')
      .select('*', { count: 'exact', head: true }),
    
    // Всего блокировок
    supabase
      .from('stop_list')
      .select('*', { count: 'exact', head: true }),
    
    // Новые обращения
    supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
  ])

  const totalNewReports = (commentReportsCount || 0) + (reviewReportsCount || 0)

  return (
    <main className="min-h-screen bg-gray-50 py-6 overflow-y-auto">
      <div className="container mx-auto px-3 max-w-7xl pb-8">
        {/* Заголовок */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            ⚙️ Админ-панель
          </h1>
          <p className="text-gray-600 text-sm">
            Добро пожаловать, {coach.display_name || 'Администратор'}!
          </p>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-blue-600">{activeBansCount || 0}</div>
                <div className="text-xs text-gray-600 mt-0.5">Активных блокировок</div>
              </div>
              <div className="text-2xl">🚫</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-orange-600">{totalNewReports || 0}</div>
                <div className="text-xs text-gray-600 mt-0.5">Жалоб за 24 часа</div>
              </div>
              <div className="text-2xl">⚠️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-green-600">{usersCount || 0}</div>
                <div className="text-xs text-gray-600 mt-0.5">Пользователей</div>
              </div>
              <div className="text-2xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-purple-600">{coursesCount || 0}</div>
                <div className="text-xs text-gray-600 mt-0.5">Курсов</div>
              </div>
              <div className="text-2xl">📚</div>
            </div>
          </div>
        </div>

        {/* Дополнительная статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <div className="text-lg">📖</div>
              <div>
                <div className="text-lg font-bold text-indigo-700">{lessonsCount || 0}</div>
                <div className="text-xs text-indigo-600">Всего уроков</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <div className="text-lg">💬</div>
              <div>
                <div className="text-lg font-bold text-orange-700">{commentReportsCount || 0}</div>
                <div className="text-xs text-orange-600">Жалоб на комментарии</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <div className="text-lg">⭐</div>
              <div>
                <div className="text-lg font-bold text-pink-700">{reviewReportsCount || 0}</div>
                <div className="text-xs text-pink-600">Жалоб на отзывы</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <div className="text-lg">📋</div>
              <div>
                <div className="text-lg font-bold text-blue-700">{newFeedbackCount || 0}</div>
                <div className="text-xs text-blue-600">Новых обращений</div>
              </div>
            </div>
          </div>
        </div>

        {/* Сетка меню - Иконка и заголовок на одной строке */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Управление</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Стоп-лист */}
          <Link
            href="/admin/stop-list"
            className="block p-3 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-xl">🚫</div>
              <h3 className="text-sm font-semibold text-gray-900">Стоп-лист</h3>
            </div>
            <p className="text-gray-600 text-xs mb-1.5">
              Управление заблокированными пользователями
            </p>
            {activeBansCount ? (
              <div className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-medium">
                {activeBansCount} активных
              </div>
            ) : null}
          </Link>

          {/* Запрещённые слова */}
          <Link
            href="/admin/banned-words"
            className="block p-3 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-xl">🚫</div>
              <h3 className="text-sm font-semibold text-gray-900">Запрещённые слова</h3>
            </div>
            <p className="text-gray-600 text-xs mb-1.5">
              Управление списком запрещённых слов
            </p>
          </Link>

          {/* Жалобы */}
          <Link
            href="/admin/reports"
            className="block p-3 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-xl">️</div>
              <h3 className="text-sm font-semibold text-gray-900">Жалобы</h3>
            </div>
            <p className="text-gray-600 text-xs mb-1.5">
              Просмотр жалоб на комментарии и отзывы
            </p>
            {totalNewReports ? (
              <div className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-medium">
                {totalNewReports} всего
              </div>
            ) : null}
          </Link>

          {/* Обратная связь */}
          <Link
            href="/admin/feedback"
            className="block p-3 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-xl">📋</div>
              <h3 className="text-sm font-semibold text-gray-900">Обратная связь</h3>
            </div>
            <p className="text-gray-600 text-xs mb-1.5">
              Баги и предложения пользователей
            </p>
            {newFeedbackCount ? (
              <div className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">
                {newFeedbackCount} новых
              </div>
            ) : null}
          </Link>

          {/* Настройки */}
          <Link
            href="/admin/settings"
            className="block p-3 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-xl">⚙️</div>
              <h3 className="text-sm font-semibold text-gray-900">Настройки</h3>
            </div>
            <p className="text-gray-600 text-xs mb-1.5">
              Параметры автоматической модерации
            </p>
          </Link>
        </div>
      </div>
    </main>
  )
}