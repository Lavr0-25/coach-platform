import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CoachesList from './CoachesList'

export default async function AdminCoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  
  const searchQuery = typeof params.search === 'string' ? params.search : ''
  const filterStatus = typeof params.status === 'string' ? params.status : 'all'

  // Получаем всех наставников
  let query = supabase
    .from('coaches')
    .select(`
      id,
      display_name,
      bio,
      specialization,
      is_verified,
      created_at,
      user_id,
      lessons (
        id
      )
    `)

  // Фильтр по статусу
  if (filterStatus === 'pending') {
    query = query.eq('is_verified', false)
  } else if (filterStatus === 'verified') {
    query = query.eq('is_verified', true)
  }

  // Поиск
  if (searchQuery) {
    query = query.or(`display_name.ilike.%${searchQuery}%,specialization.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
  }

  const { data: coaches } = await query
    .order('is_verified', { ascending: true })
    .order('created_at', { ascending: false })

  // Подсчитываем статистику
  const allCoaches = coaches || []
  const verifiedCount = allCoaches.filter(c => c.is_verified).length
  const pendingCount = allCoaches.filter(c => !c.is_verified).length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Модерация наставников
        </h1>
        <p className="text-gray-600">
          Управляйте статусом наставников платформы
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-blue-600">
            {allCoaches.length}
          </div>
          <div className="text-sm text-gray-600">Всего наставников</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-green-600">
            {verifiedCount}
          </div>
          <div className="text-sm text-gray-600">Проверенных</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-orange-600">
            {pendingCount}
          </div>
          <div className="text-sm text-gray-600">Ожидают проверки</div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="🔍 Поиск по имени, специализации..."
            defaultValue={searchQuery}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="status"
            defaultValue={filterStatus}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все</option>
            <option value="pending">⏳ Ожидают проверки</option>
            <option value="verified">✓ Проверенные</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Найти
          </button>
          {(searchQuery || filterStatus !== 'all') && (
            <Link
              href="/admin/coaches"
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {/* Список наставников (Client Component) */}
      <CoachesList initialCoaches={allCoaches} />
    </div>
  )
}