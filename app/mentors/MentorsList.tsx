'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface MentorsClientProps {
  initialCoaches: any[]
}

export default function MentorsClient({ initialCoaches }: MentorsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [coaches] = useState(initialCoaches)

  const filteredCoaches = useMemo(() => {
    let result = [...coaches]

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.display_name.toLowerCase().includes(query) ||
        c.specialization?.toLowerCase().includes(query) ||
        c.bio?.toLowerCase().includes(query)
      )
    }

    // Сортировка
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.display_name.localeCompare(b.display_name))
    } else if (sortBy === 'lessons') {
      result.sort((a, b) => (b.lessons?.length || 0) - (a.lessons?.length || 0))
    }

    return result
  }, [coaches, searchQuery, sortBy])

  return (
    <>
      {/* Поиск и сортировка */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="🔍 Поиск по имени, специализации или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Сортировка:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('newest')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'newest'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Новые
            </button>
            <button
              onClick={() => setSortBy('oldest')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'oldest'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📆 Старые
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'name'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔤 По имени
            </button>
            <button
              onClick={() => setSortBy('lessons')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'lessons'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📚 По урокам
            </button>
          </div>
        </div>
      </div>

      {/* Результаты поиска */}
      <div className="mb-4 text-sm text-gray-600">
        Найдено наставников: <span className="font-semibold">{filteredCoaches.length}</span>
      </div>

      {/* Список наставников */}
      {filteredCoaches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoaches.map((coach) => {
            const lessonsCount = coach.lessons?.length || 0

            return (
              <Link
                key={coach.id}
                href={`/mentor/${coach.id}`}
                className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-shadow block"
              >
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4 flex-shrink-0">
                    {coach.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-1">
                      {coach.display_name}
                      {coach.is_verified && (
                        <span className="text-blue-600 text-lg">✓</span>
                      )}
                    </h3>
                    {coach.specialization && (
                      <p className="text-gray-600 text-sm line-clamp-1">
                        🎯 {coach.specialization}
                      </p>
                    )}
                  </div>
                </div>

                {coach.bio && (
                  <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                    {coach.bio}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm pt-4 border-t">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span>
                      📚 {lessonsCount} {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}
                    </span>
                    <span>
                      📅 {new Date(coach.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <span className="text-blue-600 font-semibold">
                    Подробнее →
                  </span>
                </div>
              </Link>
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