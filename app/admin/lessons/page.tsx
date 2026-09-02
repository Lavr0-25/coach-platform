import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
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
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <Breadcrumbs />

        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">📚 Уроки</h1>
            <p className="text-gray-600 text-sm mt-1">Просмотр и управление уроками платформы</p>
          </div>
          <Link href="/admin" className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm">
            ← Назад
          </Link>
        </div>

        {/* Статистика — белый стиль П5: цвет только в цифре */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4">
            <div className="text-2xl md:text-3xl font-bold text-blue-600">{allLessons.length}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Всего уроков</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4">
            <div className="text-2xl md:text-3xl font-bold text-green-600">{freeCount}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Бесплатных</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4">
            <div className="text-2xl md:text-3xl font-bold text-purple-600">{paidCount}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Платных</div>
          </div>
        </div>

        {/* Поиск и фильтры */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 mb-6">
          <form className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              name="search"
              placeholder="🔍 Поиск по названию или описанию..."
              defaultValue={searchQuery}
              className="flex-1 px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
            />
            <select
              name="type"
              defaultValue={filterType}
              className="px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white transition-[box-shadow,border-color,background-color,color]"
            >
              <option value="all">Все уроки</option>
              <option value="free">Бесплатные</option>
              <option value="paid">Платные</option>
            </select>
            <button
              type="submit"
              className="gradient-btn text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-opacity text-sm"
            >
              Найти
            </button>
            {(searchQuery || filterType !== 'all') && (
              <Link
                href="/admin/lessons"
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm text-center"
              >
                Сбросить
              </Link>
            )}
          </form>
        </div>

        {/* Список уроков */}
        <LessonsList initialLessons={allLessons} />
      </div>
    </main>
  )
}