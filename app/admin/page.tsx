import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Один запрос вместо пяти!
  const { data: stats } = await supabase.rpc('get_admin_stats')

  // Если функция не создана, используем fallback
  const totalUsers = stats?.total_users || 0
  const totalCoaches = stats?.total_coaches || 0
  const totalLessons = stats?.total_lessons || 0
  const pendingCoaches = stats?.pending_coaches || 0
  const verifiedCoaches = stats?.verified_coaches || 0
  const freeLessons = stats?.free_lessons || 0
  const paidLessons = stats?.paid_lessons || 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Админ-панель
        </h1>
        <p className="text-gray-600">
          Обзор статистики платформы
        </p>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">👥</span>
            <span className="text-3xl font-bold text-blue-600">{totalUsers}</span>
          </div>
          <p className="text-gray-600 text-sm">Пользователей</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">👨‍🏫</span>
            <span className="text-3xl font-bold text-green-600">{totalCoaches}</span>
          </div>
          <p className="text-gray-600 text-sm">Наставников</p>
          <div className="text-xs text-gray-500 mt-1">
            ✓ {verifiedCoaches} проверенных | ⏳ {pendingCoaches} ожидают
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">📚</span>
            <span className="text-3xl font-bold text-purple-600">{totalLessons}</span>
          </div>
          <p className="text-gray-600 text-sm">Уроков</p>
          <div className="text-xs text-gray-500 mt-1">
            🆓 {freeLessons} бесплатных | 💰 {paidLessons} платных
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⏳</span>
            <span className="text-3xl font-bold text-orange-600">{pendingCoaches}</span>
          </div>
          <p className="text-gray-600 text-sm">Ожидают модерации</p>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Быстрые действия
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/coaches"
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
          >
            <div className="text-2xl mb-2">👨‍🏫</div>
            <div className="font-medium text-gray-900">Модерация наставников</div>
            <div className="text-sm text-gray-600 mt-1">
              {pendingCoaches} ожидают проверки
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-medium text-gray-900">Управление пользователями</div>
            <div className="text-sm text-gray-600 mt-1">
              {totalUsers} пользователей
            </div>
          </Link>

          <Link
            href="/admin/lessons"
            className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors"
          >
            <div className="text-2xl mb-2">📚</div>
            <div className="font-medium text-gray-900">Управление уроками</div>
            <div className="text-sm text-gray-600 mt-1">
              {totalLessons} уроков
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}