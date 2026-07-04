import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LessonsList from './LessonsList'

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  
  const searchQuery = typeof params.search === 'string' ? params.search : ''
  const filterType = typeof params.type === 'string' ? params.type : 'all'

  // Получаем все уроки
  let query = supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      created_at,
      coaches (
        id,
        display_name
      ),
      lesson_content (
        id,
        content_type
      )
    `)

  // Фильтр по типу
  if (filterType === 'free') {
    query = query.eq('price', 0)
  } else if (filterType === 'paid') {
    query = query.gt('price', 0)
  }

  // Поиск
  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }

  const { data: lessons } = await query
    .order('created_at', { ascending: false })

  // Статистика
  const allLessons = lessons || []
  const freeCount = allLessons.filter(l => l.price === 0 || l.is_free_preview).length
  const paidCount = allLessons.filter(l => l.price > 0 && !l.is_free_preview).length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Управление уроками
        </h1>
        <p className="text-gray-600">
          Просмотр и управление уроками платформы
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-blue-600">
            {allLessons.length}
          </div>
          <div className="text-sm text-gray-600">Всего уроков</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-green-600">
            {freeCount}
          </div>
          <div className="text-sm text-gray-600">Бесплатных</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-2xl font-bold text-purple-600">
            {paidCount}
          </div>
          <div className="text-sm text-gray-600">Платных</div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="🔍 Поиск по названию или описанию..."
            defaultValue={searchQuery}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="type"
            defaultValue={filterType}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все уроки</option>
            <option value="free">Бесплатные</option>
            <option value="paid">Платные</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Найти
          </button>
          {(searchQuery || filterType !== 'all') && (
            <Link
              href="/admin/lessons"
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {/* Список уроков */}
      <LessonsList initialLessons={allLessons} />
    </div>
  )
}