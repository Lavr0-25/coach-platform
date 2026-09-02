import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
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
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <Breadcrumbs />

        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">🎓 Наставники</h1>
            <p className="text-gray-600 text-sm mt-1">Модерация наставников платформы</p>
          </div>
          <Link href="/admin" className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm">
            ← Назад
          </Link>
        </div>

        {/* Статистика — белый стиль П5: цвет только в цифре */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4">
            <div className="text-2xl md:text-3xl font-bold text-blue-600">{allCoaches.length}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Всего наставников</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4">
            <div className="text-2xl md:text-3xl font-bold text-green-600">{verifiedCount}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Проверенных</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4">
            <div className="text-2xl md:text-3xl font-bold text-orange-600">{pendingCount}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Ожидают проверки</div>
          </div>
        </div>

        {/* Поиск и фильтры */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 mb-6">
          <form className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              name="search"
              placeholder="🔍 Поиск по имени, специализации..."
              defaultValue={searchQuery}
              className="flex-1 px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
            />
            <select
              name="status"
              defaultValue={filterStatus}
              className="px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white transition-[box-shadow,border-color,background-color,color]"
            >
              <option value="all">Все</option>
              <option value="pending">⏳ Ожидают проверки</option>
              <option value="verified">✓ Проверенные</option>
            </select>
            <button
              type="submit"
              className="gradient-btn text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-opacity text-sm"
            >
              Найти
            </button>
            {(searchQuery || filterStatus !== 'all') && (
              <Link
                href="/admin/coaches"
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm text-center"
              >
                Сбросить
              </Link>
            )}
          </form>
        </div>

        {/* Список наставников (Client Component) */}
        <CoachesList initialCoaches={allCoaches} />
      </div>
    </main>
  )
}