'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  is_free: boolean
  price: number
  created_at: string
  coach_id: string | null
  coach?: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

interface Subscription {
  coach_id: string
  subscribed_at: string
  coach: any | null
}

type FilterType = 'all' | 'new' | 'popular' | 'free'

export default function Home() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [allCoaches, setAllCoaches] = useState<Coach[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [coachSearchQuery, setCoachSearchQuery] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        const { data: lessonsData } = await supabase
          .from('lessons')
          .select(`
            *,
            coach:coaches!lessons_coach_id_fkey(display_name, avatar_url)
          `)
          .order('created_at', { ascending: false })

        if (lessonsData) {
          setLessons(lessonsData)
        }

        const { data: coachesData } = await supabase
          .from('coaches')
          .select('user_id, display_name, avatar_url, specialization')
          .order('display_name')

        if (coachesData) {
          setAllCoaches(coachesData)
        }

        if (user) {
          const { data: subsData } = await supabase
            .from('subscriptions')
            .select(`
              coach_id,
              subscribed_at,
              coach:coaches(display_name, avatar_url, specialization)
            `)
            .eq('user_id', user.id)
            .order('subscribed_at', { ascending: false })

          if (subsData) {
            setSubscriptions(subsData as any)
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubscribe = async (coachId: string) => {
    if (!user) {
      alert('Сначала войдите в систему')
      return
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          coach_id: coachId
        })

      if (error) throw error

      const { data: subsData } = await supabase
        .from('subscriptions')
        .select(`
          coach_id,
          subscribed_at,
          coach:coaches(display_name, avatar_url, specialization)
        `)
        .eq('user_id', user.id)
        .order('subscribed_at', { ascending: false })

      if (subsData) {
        setSubscriptions(subsData as any)
      }
    } catch (error) {
      console.error('Error subscribing:', error)
      alert('Ошибка при подписке')
    }
  }

  const handleUnsubscribe = async (coachId: string) => {
    if (!confirm('Отписаться от этого наставника?')) return

    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('coach_id', coachId)

      if (error) throw error

      setSubscriptions(prev => prev.filter(sub => sub.coach_id !== coachId))
    } catch (error) {
      console.error('Error unsubscribing:', error)
      alert('Ошибка при отписке')
    }
  }

  const getFilteredLessons = () => {
    let filtered = lessons

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(l => 
        l.title.toLowerCase().includes(query) ||
        l.description?.toLowerCase().includes(query)
      )
    }

    switch (activeFilter) {
      case 'new':
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        filtered = filtered.filter(l => new Date(l.created_at) >= monthAgo)
        break
      case 'popular':
        filtered = [...filtered].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 9)
        break
      case 'free':
        filtered = filtered.filter(l => l.is_free)
        break
    }

    return filtered
  }

  const filteredCoaches = allCoaches.filter(coach => {
    const query = coachSearchQuery.toLowerCase()
    return (
      coach.display_name?.toLowerCase().includes(query) ||
      coach.specialization?.toLowerCase().includes(query)
    )
  })

  const filteredLessons = getFilteredLessons()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Сегодня'
    if (days === 1) return 'Вчера'
    if (days < 7) return `${days} дней назад`
    if (days < 30) return `${Math.floor(days / 7)} нед. назад`
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'new', label: 'Новые' },
    { id: 'popular', label: 'Популярные' },
    { id: 'free', label: 'Бесплатные' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка с поиском */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск уроков..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-gray-100 border-0 rounded-full focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            {!loading && !user && (
              <Link 
                href="/login" 
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Боковая панель с подписками */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-32 mt-18">
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                {/* Поиск по наставникам */}
                <div className="mb-3 relative">
                  <input
                    type="text"
                    placeholder="Поиск наставников..."
                    value={coachSearchQuery}
                    onChange={(e) => setCoachSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Список подписок */}
                {user ? (
                  <div className="space-y-2">
                    {subscriptions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">
                        Нет подписок
                      </p>
                    ) : (
                      subscriptions.map((sub) => (
                        <div
                          key={sub.coach_id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
                        >
                          {sub.coach?.avatar_url ? (
                            <img
                              src={sub.coach.avatar_url}
                              alt={sub.coach.display_name || ''}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {sub.coach?.display_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {sub.coach?.display_name || 'Наставник'}
                            </p>
                            {sub.coach?.specialization && (
                              <p className="text-xs text-gray-500 truncate">
                                {sub.coach.specialization}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleUnsubscribe(sub.coach_id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Отписаться"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                    <Link
                      href="/mentors"
                      className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-3"
                    >
                      Все наставники →
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">
                      Войдите, чтобы подписываться
                    </p>
                    <Link
                      href="/login"
                      className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Войти
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Основной контент */}
          <main className="flex-1 min-w-0">
            {/* Фильтры */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === filter.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Сетка уроков */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm border animate-pulse">
                    <div className="aspect-video bg-gray-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'Ничего не найдено' : 'Уроки не найдены'}
                </h2>
                <p className="text-gray-600">
                  {searchQuery 
                    ? 'Попробуйте изменить запрос' 
                    : 'Пока нет доступных уроков'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredLessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/lesson/${lesson.id}`}
                    className="group bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg hover:border-blue-200 transition-all duration-200"
                  >
                    {/* Превью */}
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                      {lesson.cover_url ? (
                        <img
                          src={lesson.cover_url}
                          alt={lesson.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">
                          📚
                        </div>
                      )}
                      
                      {/* Бейдж бесплатного */}
                      {lesson.is_free && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                          Бесплатно
                        </div>
                      )}
                      
                      {/* Цена */}
                      {!lesson.is_free && lesson.price > 0 && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">
                          {lesson.price} ₽
                        </div>
                      )}
                    </div>

                    {/* Контент */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                        {lesson.title}
                      </h3>
                      
                      {lesson.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {lesson.description}
                        </p>
                      )}

                      {/* Автор и дата */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          {lesson.coach?.avatar_url ? (
                            <img
                              src={lesson.coach.avatar_url}
                              alt={lesson.coach.display_name || ''}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                              {lesson.coach?.display_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <span className="truncate max-w-[120px]">
                            {lesson.coach?.display_name || 'Наставник'}
                          </span>
                        </div>
                        <span>{formatDate(lesson.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Результаты поиска наставников */}
            {coachSearchQuery && user && (
              <div className="mt-8 bg-white rounded-xl p-4 shadow-sm border">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Найдено наставников: {filteredCoaches.length}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCoaches.slice(0, 6).map((coach) => {
                    const isSubscribed = subscriptions.some(s => s.coach_id === coach.user_id)
                    return (
                      <div
                        key={coach.user_id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        {coach.avatar_url ? (
                          <img
                            src={coach.avatar_url}
                            alt={coach.display_name || ''}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {coach.display_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {coach.display_name || 'Наставник'}
                          </p>
                          {coach.specialization && (
                            <p className="text-xs text-gray-500 truncate">
                              {coach.specialization}
                            </p>
                          )}
                        </div>
                        {isSubscribed ? (
                          <button
                            onClick={() => handleUnsubscribe(coach.user_id)}
                            className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Отписаться
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSubscribe(coach.user_id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Подписаться
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}