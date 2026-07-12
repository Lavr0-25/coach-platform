'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface ProfileFiltersProps {
  profileId: string
  filterType: string
  sortBy: string
  ratingFilter: string
  searchQuery?: string
  totalLessons: number
  totalCourses: number
}

export default function ProfileFilters({
  profileId,
  filterType,
  sortBy,
  ratingFilter,
  searchQuery,
  totalLessons,
  totalCourses
}: ProfileFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const buildUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    return `/profile/${profileId}?${params.toString()}`
  }

  const handleFilterChange = (key: string, value: string) => {
    router.push(buildUrl({ [key]: value }))
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const searchValue = formData.get('search') as string
    
    router.push(buildUrl({ search: searchValue }))
  }

  return (
    <>
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <a
            href={buildUrl({ type: 'all' })}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все ({totalLessons + totalCourses})
          </a>
          <a
            href={buildUrl({ type: 'lessons' })}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'lessons' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
             Уроки ({totalLessons})
          </a>
          <a
            href={buildUrl({ type: 'courses' })}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'courses' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📚 Курсы ({totalCourses})
          </a>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Фильтр по рейтингу */}
          <select
            value={ratingFilter}
            onChange={(e) => handleFilterChange('rating', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Все рейтинги</option>
            <option value="4.5">4.5★ и выше</option>
            <option value="4">4★ и выше</option>
            <option value="3">3★ и выше</option>
          </select>

          {/* Сортировка */}
          <select
            value={sortBy}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="rating">По рейтингу</option>
            <option value="comments">По комментариям</option>
          </select>
        </div>
      </div>
    </>
  )
}