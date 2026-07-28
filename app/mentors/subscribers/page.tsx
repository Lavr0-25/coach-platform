'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Subscriber {
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  subscribed_at: string
}

const ITEMS_PER_PAGE = 10

export default function SubscribersPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [coachId, setCoachId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [totalSubscribers, setTotalSubscribers] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  // Debounce для поиска
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setDebouncedSearch('')
    }
  }, [searchQuery])

  // Сбрасываем страницу на 1 при изменении поиска
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  // Загрузка при изменении страницы или поиска
  useEffect(() => {
    if (user && coachId) {
      loadSubscribers()
    }
  }, [user, coachId, currentPage, debouncedSearch])

  const loadData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('Auth error:', authError)
        redirect('/login')
        return
      }
      
      setUser(user)

      // Получаем coach record
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single()

      if (coachError || !coachData) {
        console.error('Coach error:', coachError)
        // Если coach не найден, перенаправляем на создание профиля
        redirect('/dashboard/mentor')
        return
      }
      
      setCoachId(coachData.id)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubscribers = async () => {
    if (!user || !coachId) return

    setLoading(true)
    try {
      // 1. Получаем все подписки этого автора
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('user_id, subscribed_at')
        .eq('coach_id', user.id)
        .order('subscribed_at', { ascending: false })

      if (subsError) {
        console.error('Subscriptions error:', subsError)
        throw subsError
      }

      if (!subsData || subsData.length === 0) {
        setSubscribers([])
        setTotalSubscribers(0)
        setLoading(false)
        return
      }

      // 2. Получаем уникальные user_id
      const userIds = Array.from(new Set(subsData.map(s => s.user_id)))

      // 3. Получаем профили этих пользователей
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds)

      if (profilesError) {
        console.error('Profiles error:', profilesError)
        throw profilesError
      }

      // 4. Объединяем данные в памяти
      const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || [])

      const allSubscribers: Subscriber[] = subsData.map(s => {
        const profile = profilesMap.get(s.user_id)
        return {
          user_id: s.user_id,
          email: profile?.email || '',
          display_name: profile?.full_name || profile?.email?.split('@')[0] || 'Пользователь',
          avatar_url: profile?.avatar_url,
          subscribed_at: s.subscribed_at,
        }
      })

      // 5. Фильтрация по поиску (на клиенте)
      let filtered = allSubscribers
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        filtered = filtered.filter(s => 
          s.email.toLowerCase().includes(query) || 
          (s.display_name && s.display_name.toLowerCase().includes(query))
        )
      }

      // 6. Пагинация на клиенте
      const total = filtered.length
      setTotalSubscribers(total)
      
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE
      const paginated = filtered.slice(from, to)

      setSubscribers(paginated)
    } catch (error) {
      console.error('Error loading subscribers:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const totalPages = Math.ceil(totalSubscribers / ITEMS_PER_PAGE)

  if (loading && subscribers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor/profile" className="hover:text-purple-600 transition-colors">
          Личный кабинет
        </Link>
        <span>/</span>
        <Link href="/mentor/analytics" className="hover:text-purple-600 transition-colors">
          Аналитика
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Подписчики</span>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
          Мои подписчики
        </h1>
        <p className="text-gray-600">
          {totalSubscribers} {totalSubscribers === 1 ? 'подписчик' : totalSubscribers < 5 ? 'подписчика' : 'подписчиков'}
        </p>
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full px-5 py-3 pl-12 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <svg 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Список подписчиков */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="style-card p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : subscribers.length === 0 ? (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {debouncedSearch ? 'Ничего не найдено' : 'Пока нет подписчиков'}
          </h2>
          <p className="text-gray-600">
            {debouncedSearch 
              ? 'Попробуйте изменить поисковый запрос'
              : 'Когда кто-то подпишется на вас, они появятся здесь'}
          </p>
          {debouncedSearch && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
            >
              Сбросить поиск
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {subscribers.map((subscriber) => (
              <div
                key={subscriber.user_id}
                className="style-card p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {subscriber.avatar_url ? (
                        <img 
                          src={subscriber.avatar_url} 
                          alt={subscriber.display_name || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(subscriber.display_name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                        {subscriber.display_name || 'Пользователь'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{subscriber.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Подписан {formatDate(subscriber.subscribed_at)}
                      </p>
                    </div>
                  </div>
                  
                  <Link
                    href={`/mentor/${subscriber.user_id}`}
                    className="ml-4 px-5 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors flex items-center gap-2"
                  >
                    Профиль
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Назад
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-xl font-medium transition-colors ${
                      currentPage === page
                        ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                        : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Вперёд →
              </button>
            </div>
          )}

          {/* Информация о страницах */}
          <p className="text-center text-sm text-gray-500 mt-4">
            Показано {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalSubscribers)} из {totalSubscribers}
          </p>
        </>
      )}
    </main>
  )
}