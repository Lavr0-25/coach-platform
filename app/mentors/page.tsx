'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

interface CoachWithContent {
  id: string
  display_name: string | null
  specialization: string | null
  bio: string | null
  avatar_url: string | null
  user_id: string
  role: string
  lessonsCount: number
  coursesCount: number
  totalContent: number
}

export default function MentorsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [coaches, setCoaches] = useState<CoachWithContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const query = searchParams.get('search') || ''
    setSearchQuery(query)
    fetchCoaches(query)
  }, [searchParams])

  const fetchCoaches = async (query: string) => {
    setIsLoading(true)
    
    try {
      // Получаем всех наставников и админов
      let coachQuery = supabase
        .from('coaches')
        .select('id, display_name, specialization, bio, avatar_url, user_id, role')
        .in('role', ['mentor', 'admin'])

      // Поиск по имени или специализации
      if (query) {
        coachQuery = coachQuery.or(`display_name.ilike.%${query}%,specialization.ilike.%${query}%`)
      }

      coachQuery = coachQuery.order('display_name')

      const { data: coachesData } = await coachQuery

      const coachesWithContent: CoachWithContent[] = []

      if (coachesData) {
        for (const coach of coachesData) {
          // Проверяем уроки
          const { count: lessonsCount } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true })
            .eq('coach_id', coach.id)

          // Проверяем курсы
          const { count: coursesCount } = await supabase
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('coach_id', coach.id)

          const lCount = lessonsCount || 0
          const cCount = coursesCount || 0

          // Если есть хотя бы один урок или курс
          if (lCount > 0 || cCount > 0) {
            coachesWithContent.push({
              ...coach,
              lessonsCount: lCount,
              coursesCount: cCount,
              totalContent: lCount + cCount
            })
          }
        }
      }

      setCoaches(coachesWithContent)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    // Обновляем URL с debounce
    const timeoutId = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams.toString())
      if (value) {
        newParams.set('search', value)
      } else {
        newParams.delete('search')
      }
      router.push(`/mentors?${newParams.toString()}`)
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  const clearSearch = () => {
    setSearchQuery('')
    router.push('/mentors')
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Наставники</h1>
          <p className="text-gray-600">
            Изучайте бесплатные материалы и находите полезных наставников
          </p>
        </div>

        {/* Поиск - как в каталоге */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Поиск по названию, описанию или наставнику..."
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Результат поиска */}
        <div className="mb-4">
          <p className="text-gray-600">
            Найдено наставников: <span className="font-semibold">{coaches.length}</span>
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : coaches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => (
              <Link
                key={coach.user_id}
                href={`/profile/${coach.user_id}`}
                className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {coach.avatar_url ? (
                      <img
                        src={coach.avatar_url}
                        alt={coach.display_name || 'Ментор'}
                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-100"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {coach.display_name?.charAt(0).toUpperCase() || 'M'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {coach.display_name}
                    </h3>
                    {coach.specialization && (
                      <p className="text-sm text-gray-600 mb-2">{coach.specialization}</p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="text-blue-600">🎬</span>
                        {coach.lessonsCount} уроков
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-purple-600"></span>
                        {coach.coursesCount} курсов
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <p className="text-gray-600 text-lg">
              {searchQuery 
                ? 'Наставники не найдены' 
                : 'Пока нет наставников с активными материалами'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}