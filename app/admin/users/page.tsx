import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UsersList from './UsersList'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  
  const searchQuery = typeof params.search === 'string' ? params.search : ''
  const filterRole = typeof params.role === 'string' ? params.role : 'all'

  // Получаем всех пользователей (кроме студентов, если нужно)
  let query = supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      role,
      created_at,
      coaches (
        id,
        display_name,
        is_verified
      ),
      user_bans (
        id,
        reason,
        banned_at,
        unbanned_at,
        is_active
      )
    `)

  // Фильтр по роли
  if (filterRole !== 'all') {
    query = query.eq('role', filterRole)
  }

  // Поиск
  if (searchQuery) {
    query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
  }

  const { data: users } = await query
    .order('created_at', { ascending: false })

  // Статистика
  const allUsers = users || []
  const adminCount = allUsers.filter(u => u.role === 'admin').length
  const mentorCount = allUsers.filter(u => u.role === 'mentor').length
  const bannedCount = allUsers.filter(u => u.user_bans?.some((b: any) => b.is_active)).length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Управление пользователями
        </h1>
        <p className="text-gray-600">
          Просмотр и управление пользователями платформы
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-blue-600">
            {allUsers.length}
          </div>
          <div className="text-sm text-gray-600">Всего пользователей</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-red-600">
            {adminCount}
          </div>
          <div className="text-sm text-gray-600">Администраторов</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-green-600">
            {mentorCount}
          </div>
          <div className="text-sm text-gray-600">Наставников</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-orange-600">
            {bannedCount}
          </div>
          <div className="text-sm text-gray-600">Заблокировано</div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="🔍 Поиск по имени или email..."
            defaultValue={searchQuery}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="role"
            defaultValue={filterRole}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все роли</option>
            <option value="admin">Администраторы</option>
            <option value="mentor">Наставники</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Найти
          </button>
          {(searchQuery || filterRole !== 'all') && (
            <Link
              href="/admin/users"
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {/* Список пользователей */}
      <UsersList initialUsers={allUsers} />
    </div>
  )
}