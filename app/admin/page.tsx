import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Проверяем, является ли пользователь админом
  const { data: coach } = await supabase
    .from('coaches')
    .select('role, display_name')
    .eq('user_id', user.id)
    .single()

  if (coach?.role !== 'admin') {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ️ Админ-панель
          </h1>
          <p className="text-gray-600">
            Добро пожаловать, {coach.display_name || 'Администратор'}!
          </p>
        </div>

        {/* Сетка меню */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Стоп-лист */}
          <Link
            href="/admin/stop-list"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">🚫</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Стоп-лист
            </h3>
            <p className="text-gray-600 text-sm">
              Управление заблокированными пользователями
            </p>
          </Link>

          {/* Пользователи */}
          <Link
            href="/admin/users"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Пользователи
            </h3>
            <p className="text-gray-600 text-sm">
              Просмотр и управление пользователями
            </p>
          </Link>

          {/* Жалобы */}
          <Link
            href="/admin/reports"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Жалобы
            </h3>
            <p className="text-gray-600 text-sm">
              Просмотр жалоб на комментарии
            </p>
          </Link>

          {/* Курсы */}
          <Link
            href="/admin/courses"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">📚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Курсы
            </h3>
            <p className="text-gray-600 text-sm">
              Управление курсами платформы
            </p>
          </Link>

          {/* Уроки */}
          <Link
            href="/admin/lessons"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">📖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Уроки
            </h3>
            <p className="text-gray-600 text-sm">
              Управление уроками
            </p>
          </Link>

          {/* Настройки */}
          <Link
            href="/admin/settings"
            className="block p-6 bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="text-4xl mb-3">️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Настройки
            </h3>
            <p className="text-gray-600 text-sm">
              Общие настройки платформы
            </p>
          </Link>
        </div>

        {/* Статистика */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="text-2xl font-bold text-blue-600">0</div>
            <div className="text-sm text-gray-600">Активных блокировок</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="text-2xl font-bold text-orange-600">0</div>
            <div className="text-sm text-gray-600">Новых жалоб</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="text-2xl font-bold text-green-600">0</div>
            <div className="text-sm text-gray-600">Пользователей</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="text-2xl font-bold text-purple-600">0</div>
            <div className="text-sm text-gray-600">Курсов</div>
          </div>
        </div>
      </div>
    </main>
  )
}