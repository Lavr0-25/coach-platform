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
  rating?: number
  reviews_count?: number
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

type FilterType = 'all' | 'new' | 'popular' | 'free' | 'subscriptions'

const LESSONS_PER_PAGE = 9

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
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        const { data: coachesData } = await supabase
          .from('coaches')
          .select('user_id, display_name, avatar_url, specialization')
          .order('display_name')

        if (coachesData) setAllCoaches(coachesData)

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
      }
    }

    loadData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Загрузка уроков при изменении фильтра
  useEffect(() => {
    const loadLessons = async () => {
      setLoading(true)
      setPage(1)
      setHasMore(true)

      try {
        let query = supabase
          .from('lessons')
          .select(`
            *,
            coach:coaches!lessons_coach_id_fkey(display_name, avatar_url)
          `)

        // Применяем фильтры
        switch (activeFilter) {
          case 'new':
            query = query.order('created_at', { ascending: false })
            break
          case 'popular':
            query = query.order('created_at', { ascending: false })
            break
          case 'free':
            // Бесплатные фильтруем на клиенте
            break
          case 'subscriptions':
            if (subscriptions.length > 0) {
              // Получаем user_id подписанных наставников
              const subscribedUserIds = subscriptions.map(s => s.coach_id)
              
              // Находим coaches.id для этих user_id
              const { data: coachesData } = await supabase
                .from('coaches')
                .select('id')
                .in('user_id', subscribedUserIds)
              
              if (coachesData && coachesData.length > 0) {
                const coachIds = coachesData.map(c => c.id)
                query = query.in('coach_id', coachIds).order('created_at', { ascending: false })
              } else {
                setLessons([])
                setLoading(false)
                return
              }
            } else {
              setLessons([])
              setLoading(false)
              return
            }
            break
          default:
            break
        }

        const { data, error } = await query

        if (error) throw error

        if (data) {
          let processedLessons = data as Lesson[]

          // Фильтр бесплатных на клиенте
          if (activeFilter === 'free') {
            processedLessons = processedLessons.filter(lesson => 
              lesson.price === 0 || lesson.is_free === true
            )
          }

          // Для "Популярных" считаем количество отзывов
          if (activeFilter === 'popular') {
            const lessonsWithReviews = await Promise.all(
              processedLessons.map(async (lesson) => {
                const { data: reviews, error: reviewsError } = await supabase
                  .from('reviews')
                  .select('rating')
                  .eq('lesson_id', lesson.id)

                const reviewsCount = reviews?.length || 0
                const avgRating = reviews && reviews.length > 0
                  ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                  : 0

                return { 
                  ...lesson, 
                  reviews_count: reviewsCount,
                  rating: avgRating
                }
              })
            )
            
            processedLessons = lessonsWithReviews.sort((a, b) => {
              if (b.reviews_count !== a.reviews_count) {
                return b.reviews_count - a.reviews_count
              }
              return (b.rating || 0) - (a.rating || 0)
            })
          }

          // Для "Все" перемешиваем
          if (activeFilter === 'all') {
            processedLessons = processedLessons.sort(() => Math.random() - 0.5)
          }

          // Для "Бесплатных" сортируем по дате
          if (activeFilter === 'free') {
            processedLessons = processedLessons.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          }

          setLessons(processedLessons.slice(0, LESSONS_PER_PAGE))
          setHasMore(processedLessons.length > LESSONS_PER_PAGE)
        }
      } catch (error) {
        console.error('Error loading lessons:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLessons()
  }, [activeFilter, subscriptions])

  // Загрузка следующей страницы
  const loadMore = () => {
    const nextPage = page + 1
    const endIndex = nextPage * LESSONS_PER_PAGE
    
    if (lessons.length < endIndex) {
      return
    }
    
    setPage(nextPage)
  }

  const handleSubscribe = async (coachId: string) => {
    if (!user) {
      alert('Сначала войдите в систему')
      return
    }

    setSubscribing(coachId)

    try {
      const { error } = await supabase
        .from('subscriptions')
        .insert({ user_id: user.id, coach_id: coachId })

      if (error) {
        if (error.code === '23505') {
          alert('Вы уже подписаны на этого наставника')
        } else throw error
        return
      }

      const { data: subsData } = await supabase
        .from('subscriptions')
        .select(`
          coach_id,
          subscribed_at,
          coach:coaches(display_name, avatar_url, specialization)
        `)
        .eq('user_id', user.id)
        .order('subscribed_at', { ascending: false })

      if (subsData) setSubscriptions(subsData as any)
    } catch (error) {
      console.error('Error subscribing:', error)
      alert('Ошибка при подписке')
    } finally {
      setSubscribing(null)
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

    return filtered
  }

  const filteredCoaches = allCoaches.filter(coach => {
    const query = coachSearchQuery.toLowerCase()
    return (
      coach.display_name?.toLowerCase().includes(query) ||
      coach.specialization?.toLowerCase().includes(query)
    )
  })

  const displayedLessons = getFilteredLessons()

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
    ...(user ? [{ id: 'subscriptions' as FilterType, label: 'Подписки' }] : []),
  ]

  return (
    <div className="min-h-screen">
      {/* Шапка с поиском */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск уроков..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 bg-purple-50/50 border border-purple-200 rounded-full focus:bg-white focus:ring-2 focus:ring-purple-400/30 focus:border-purple-300 transition-all text-sm"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            {!loading && !user && (
              <Link 
                href="/login" 
                className="gradient-btn px-6 py-2.5 text-white text-sm font-medium rounded-full"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="flex gap-8">
          {/* Боковая панель */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-32">
              <div className="style-card p-5">
                {/* Поиск по наставникам */}
                <div className="mb-4 relative">
                  <input
                    type="text"
                    placeholder="Поиск наставников..."
                    value={coachSearchQuery}
                    onChange={(e) => setCoachSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm bg-purple-50/50 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-300"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Список */}
                {user ? (
                  <div className="space-y-2">
                    {coachSearchQuery ? (
                      filteredCoaches.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-3">
                          Наставники не найдены
                        </p>
                      ) : (
                        filteredCoaches.map((coach) => {
                          const isSubscribed = subscriptions.some(s => s.coach_id === coach.user_id)
                          return (
                            <div
                              key={coach.user_id}
                              className="flex items-center gap-3 p-2.5 bg-purple-50/30 rounded-xl hover:bg-purple-50/60 transition-colors"
                            >
                              {coach.avatar_url ? (
                                <img
                                  src={coach.avatar_url}
                                  alt={coach.display_name || ''}
                                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 gradient-icon rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {coach.display_name?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
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
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                  title="Отписаться"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSubscribe(coach.user_id)}
                                  disabled={subscribing === coach.user_id}
                                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                                  title="Подписаться"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )
                        })
                      )
                    ) : (
                      <>
                        {isExpanded && (
                          <div className="max-h-96 overflow-y-auto space-y-2">
                            {subscriptions.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-3">
                                Нет подписок
                              </p>
                            ) : (
                              subscriptions.map((sub) => (
                                <div
                                  key={sub.coach_id}
                                  className="flex items-center gap-3 p-2.5 bg-purple-50/30 rounded-xl group"
                                >
                                  {sub.coach?.avatar_url ? (
                                    <img
                                      src={sub.coach.avatar_url}
                                      alt={sub.coach.display_name || ''}
                                      className="w-9 h-9 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 gradient-icon rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {sub.coach?.display_name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
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
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                                    title="Отписаться"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        
                        <button
                          onClick={() => setIsExpanded(!isExpanded)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-xl transition-colors font-medium"
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <span>{isExpanded ? 'Свернуть' : 'Развернуть'}</span>
                        </button>
                      </>
                    )}
                    <Link
                      href="/mentors"
                      className="block text-center text-sm text-purple-600 hover:text-purple-700 font-semibold mt-4"
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
                      className="inline-block gradient-btn px-6 py-2.5 text-white text-sm rounded-full font-medium"
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
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    activeFilter === filter.id
                      ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                      : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
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
                  <div key={i} className="style-card overflow-hidden animate-pulse">
                    <div className="aspect-video bg-purple-100" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-purple-100 rounded w-3/4" />
                      <div className="h-3 bg-purple-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedLessons.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4"></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {activeFilter === 'subscriptions' 
                    ? 'Нет уроков от ваших подписок' 
                    : searchQuery 
                      ? 'Ничего не найдено' 
                      : 'Уроки не найдены'}
                </h2>
                <p className="text-gray-600">
                  {activeFilter === 'subscriptions'
                    ? 'Подпишитесь на наставников, чтобы видеть их уроки'
                    : searchQuery 
                      ? 'Попробуйте изменить запрос' 
                      : 'Пока нет доступных уроков'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {displayedLessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={`/lesson/${lesson.id}`}
                      className="group style-card overflow-hidden"
                    >
                      {/* Превью */}
                      <div className="aspect-video bg-gradient-to-br from-purple-100 via-indigo-50 to-blue-100 relative overflow-hidden">
                        {lesson.cover_url ? (
                          <img
                            src={lesson.cover_url}
                            alt={lesson.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-16 h-16 gradient-icon rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
                              📚
                            </div>
                          </div>
                        )}
                        
                        {lesson.is_free && (
                          <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                            Бесплатно
                          </div>
                        )}
                        
                        {!lesson.is_free && lesson.price > 0 && (
                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                            {lesson.price} ₽
                          </div>
                        )}
                      </div>

                      {/* Контент */}
                      <div className="p-5">
                        <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-purple-600 transition-colors text-base">
                          {lesson.title}
                        </h3>
                        
                        {lesson.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                            {lesson.description}
                          </p>
                        )}

                        {/* Рейтинг и отзывы */}
                        {lesson.reviews_count !== undefined && lesson.reviews_count > 0 && (
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= Math.round(lesson.rating || 0)
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">
                              {lesson.rating?.toFixed(1)} ({lesson.reviews_count} {lesson.reviews_count === 1 ? 'отзыв' : lesson.reviews_count < 5 ? 'отзыва' : 'отзывов'})
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-purple-100">
                          <div className="flex items-center gap-2">
                            {lesson.coach?.avatar_url ? (
                              <img
                                src={lesson.coach.avatar_url}
                                alt={lesson.coach.display_name || ''}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 gradient-icon rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                {lesson.coach?.display_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                            <span className="truncate max-w-[120px] font-medium">
                              {lesson.coach?.display_name || 'Наставник'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {activeFilter === 'popular' && lesson.reviews_count !== undefined && (
                              <span className="flex items-center gap-1 text-purple-600 font-medium">
                                💬 {lesson.reviews_count}
                              </span>
                            )}
                            <span>{formatDate(lesson.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Кнопка "Загрузить ещё" */}
                {hasMore && (
                  <div className="text-center mt-8">
                    <button
                      onClick={loadMore}
                      className="gradient-btn px-8 py-3 text-white font-semibold rounded-full"
                    >
                      Загрузить ещё
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}