'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface CatalogClientProps {
  initialLessons: any[]
}

export default function CatalogClient({ initialLessons }: CatalogClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filterType, setFilterType] = useState('all')

  // Фильтруем и сортируем на клиенте
  const filteredLessons = useMemo(() => {
    let result = [...initialLessons]

    // Фильтр по типу
    if (filterType === 'free') {
      result = result.filter(l => l.price === 0 || l.is_free_preview)
    } else if (filterType === 'paid') {
      result = result.filter(l => l.price > 0 && !l.is_free_preview)
    }

    // Поиск по названию, описанию и имени наставника
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(l => 
        l.title.toLowerCase().includes(query) ||
        l.description?.toLowerCase().includes(query) ||
        l.coaches?.display_name?.toLowerCase().includes(query) ||
        l.coaches?.specialization?.toLowerCase().includes(query)
      )
    }

    // Сортировка
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    }

    return result
  }, [initialLessons, filterType, searchQuery, sortBy])

  const getContentIcon = (contentType: string) => {
    const icons: Record<string, string> = {
      youtube: '🎥',
      vk_video: '🎬',
      yandex_disk: '📁',
      pdf: '📄',
      image: '🖼️',
      presentation: '📊',
    }
    return icons[contentType] || '📚'
  }

  return (
    <>
      {/* Поиск и фильтры */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="🔍 Поиск по названию, описанию или наставнику..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Фильтр по типу */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setFilterType('free')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'free'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🆓 Бесплатные
            </button>
            <button
              onClick={() => setFilterType('paid')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'paid'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💰 Платные
            </button>
          </div>

          {/* Сортировка */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">📅 Сначала новые</option>
              <option value="price_asc">💰 Сначала дешёвые</option>
              <option value="price_desc">💎 Сначала дорогие</option>
            </select>
          </div>
        </div>
      </div>

      {/* Результаты */}
      <div className="mb-4 text-sm text-gray-600">
        Найдено уроков: <span className="font-semibold">{filteredLessons.length}</span>
      </div>

      {/* Список уроков */}
      {filteredLessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => {
            const content = lesson.lesson_content?.[0]
            const icon = getContentIcon(content?.content_type)
            const isFree = lesson.price === 0 || lesson.is_free_preview

            return (
              <div
                key={lesson.id}
                className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-shadow flex flex-col"
              >
                {/* Заголовок с иконкой */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-4xl flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-1">
                      {lesson.title}
                    </h3>
                    {lesson.coaches && (
                      <p className="text-sm text-gray-500">
                        👨‍🏫 {lesson.coaches.display_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Описание */}
                {lesson.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                    {lesson.description}
                  </p>
                )}

                {/* Цена и кнопка */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t">
                  <div>
                    {isFree ? (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        🆓 Бесплатно
                      </span>
                    ) : (
                      <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        💰 {lesson.price} ₽
                      </span>
                    )}
                  </div>
                  
                  <Link
                    href={`/lesson/${lesson.id}`}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isFree
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {isFree ? '▶ Смотреть' : 'Подробнее →'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Ничего не найдено
          </h2>
          <p className="text-gray-600 mb-6">
            Попробуйте изменить параметры поиска
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setFilterType('all')
              setSortBy('newest')
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </>
  )
}