'use client'

// Клиентская часть главной: вся интерактивность (фильтры, поиск, подписки,
// «Загрузить ещё») работает на данных, которые сервер передал пропсами.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FavoriteButton from '@/components/FavoriteButton'
import { useSearch } from '@/components/SearchContext'
import { useToast } from '@/components/Toast'
import { Card } from '@/components/ui/Card'

export interface HomeItem {
  id: string
  type: 'lesson' | 'course'
  title: string
  description: string | null
  cover_image: string | null
  is_free: boolean
  price: number
  created_at: string
  coach_id: string | null
  rating: number
  reviews_count: number
  coach: { display_name: string | null; avatar_url: string | null } | null
}

export interface HomeCoach {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

export interface HomeSubscription {
  coach_id: string
  coach: { display_name: string | null; avatar_url: string | null; specialization: string | null } | null
}

type FilterType = 'all' | 'new' | 'popular' | 'free' | 'subscriptions'
type ContentType = 'all' | 'lessons' | 'courses'

const ITEMS_PER_PAGE = 9

export default function HomeFeed({
  initialItems,
  coaches,
  initialUser,
  initialSubscriptions,
}: {
  initialItems: HomeItem[]
  coaches: HomeCoach[]
  initialUser: { id: string } | null
  initialSubscriptions: HomeSubscription[]
}) {
  const toast = useToast()
  const supabase = createClient()
  const [user, setUser] = useState<{ id: string } | null>(initialUser)
  const [subscriptions, setSubscriptions] = useState<HomeSubscription[]>(initialSubscriptions)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [contentType, setContentType] = useState<ContentType>('all')
  // Поиск общий с шапкой: на десктопе поле в Navbar, на мобильных — здесь
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch()
  const [coachSearchQuery, setCoachSearchQuery] = useState('')
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [page, setPage] = useState(1)
  // Порядок для фильтра «Все» перемешивается на клиенте (на сервере — по дате,
  // чтобы HTML был детерминированным и гидрация не расходилась)
  const [shuffled, setShuffled] = useState<HomeItem[]>([])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
      if (!session?.user) {
        setSubscriptions([])
        setActiveFilter('all')
      }
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shuffle = (arr: HomeItem[]) => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  // Пересобираем порядок/сортировку при смене фильтра
  useEffect(() => {
    setPage(1)
    if (activeFilter === 'all') {
      setShuffled(shuffle(initialItems))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, initialItems])

  const processedContent = useMemo(() => {
    let items = activeFilter === 'all' && shuffled.length > 0 ? shuffled : initialItems

    if (contentType !== 'all') {
      const t = contentType === 'lessons' ? 'lesson' : 'course'
      items = items.filter(i => i.type === t)
    }

    if (activeFilter === 'free') {
      items = items.filter(i => i.price === 0 || i.is_free)
    }

    if (activeFilter === 'subscriptions') {
      // Подписки хранят user_id автора — переводим в id строки coaches
      const subscribedUserIds = new Set(subscriptions.map(s => s.coach_id))
      const subscribedCoachIds = new Set(
        coaches.filter(c => subscribedUserIds.has(c.user_id)).map(c => c.id)
      )
      items = items.filter(i => i.coach_id && subscribedCoachIds.has(i.coach_id))
    }

    if (activeFilter === 'popular') {
      items = [...items].sort((a, b) =>
        b.reviews_count !== a.reviews_count
          ? b.reviews_count - a.reviews_count
          : (b.rating || 0) - (a.rating || 0)
      )
    }

    return items
  }, [initialItems, shuffled, activeFilter, contentType, subscriptions, coaches])

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return processedContent
    const query = searchQuery.toLowerCase()
    // Ищем по названию, описанию и имени автора урока/курса
    return processedContent.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.coach?.display_name?.toLowerCase().includes(query)
    )
  }, [processedContent, searchQuery])

  const displayedContent = filteredBySearch.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = filteredBySearch.length > displayedContent.length

  const filteredCoaches = coaches.filter(coach => {
    const query = coachSearchQuery.toLowerCase()
    return (
      coach.display_name?.toLowerCase().includes(query) ||
      coach.specialization?.toLowerCase().includes(query)
    )
  })

  const handleSubscribe = async (coachUserId: string) => {
    if (!user) {
      toast.showToast('Сначала войдите в систему', 'info')
      return
    }

    setSubscribing(coachUserId)

    try {
      const { error } = await supabase
        .from('subscriptions')
        .insert({ user_id: user.id, coach_id: coachUserId })

      if (error) {
        if (error.code === '23505') {
          toast.showToast('Вы уже подписаны на этого автора', 'info')
        } else throw error
        return
      }

      const { data: subsData } = await supabase
        .from('subscriptions')
        .select(`
          coach_id,
          coach:coaches(display_name, avatar_url, specialization)
        `)
        .eq('user_id', user.id)
        .order('subscribed_at', { ascending: false })

      // Встроенный join supabase-js типизирует как массив — нормализуем
      const normalized = (subsData || []).map((s) => ({
        coach_id: s.coach_id,
        coach: Array.isArray(s.coach) ? s.coach[0] ?? null : s.coach,
      }))
      setSubscriptions(normalized)
    } catch (error) {
      console.error('Error subscribing:', error)
      toast.showToast('Ошибка при подписке', 'error')
    } finally {
      setSubscribing(null)
    }
  }

  const handleUnsubscribe = async (coachUserId: string) => {
    if (!user) return
    if (!confirm('Отписаться от этого автора?')) return

    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('coach_id', coachUserId)

      if (error) throw error

      setSubscriptions(prev => prev.filter(sub => sub.coach_id !== coachUserId))
    } catch (error) {
      console.error('Error unsubscribing:', error)
      toast.showToast('Ошибка при отписке', 'error')
    }
  }

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

  return (
    <div className="min-h-screen">
      {/* Шапка с поиском — только мобильные/планшет: на десктопе поиск в Navbar */}
      <div className="lg:hidden bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск уроков и курсов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 bg-purple-50/50 border border-purple-200 rounded-full focus:bg-white focus:ring-2 focus:ring-purple-400/30 focus:border-purple-300 transition-[box-shadow,border-color,background-color,color] text-sm"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {!user && (
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

      <div className="container mx-auto px-4 pt-20 pb-8">
        <div className="flex gap-8">
          {/* Боковая панель */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-32">
              <Card variant="glow" padding="none" className="p-5">
                {/* Поиск по авторам */}
                <div className="mb-4 relative">
                  <input
                    type="text"
                    placeholder="Поиск авторов..."
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
                          Авторы не найдены
                        </p>
                      ) : (
                        filteredCoaches.map((coach) => {
                          const isSubscribed = subscriptions?.some(s => s.coach_id === coach.user_id)
                          return (
                            <div
                              key={coach.user_id}
                              className="flex items-center gap-3 p-2.5 bg-purple-50/30 rounded-xl hover:bg-purple-50/60 transition-colors"
                            >
                              <Link
                                href={`/mentor/${coach.user_id}`}
                                className="flex items-center gap-3 flex-1 min-w-0 group"
                              >
                                {coach.avatar_url ? (
                                  <img
                                    src={coach.avatar_url}
                                    alt={coach.display_name || ''}
                                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 group-hover:ring-2 group-hover:ring-purple-400 transition-shadow"
                                  />
                                ) : (
                                  <div className="w-9 h-9 gradient-icon rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:ring-2 group-hover:ring-purple-400 transition-[box-shadow,border-color,background-color,color]">
                                    {coach.display_name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                                    {coach.display_name || 'Автор'}
                                  </p>
                                  {coach.specialization && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {coach.specialization}
                                    </p>
                                  )}
                                </div>
                              </Link>
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
                            {subscriptions?.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-3">
                                Нет подписок
                              </p>
                            ) : (
                              subscriptions?.map((sub) => (
                                <div
                                  key={sub.coach_id}
                                  className="flex items-center gap-3 p-2.5 bg-purple-50/30 rounded-xl group"
                                >
                                  <Link
                                    href={`/mentor/${sub.coach_id}`}
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                  >
                                    {sub.coach?.avatar_url ? (
                                      <img
                                        src={sub.coach.avatar_url}
                                        alt={sub.coach.display_name || ''}
                                        className="w-9 h-9 rounded-full object-cover group-hover:ring-2 group-hover:ring-purple-400 transition-shadow"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 gradient-icon rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:ring-2 group-hover:ring-purple-400 transition-[box-shadow,border-color,background-color,color]">
                                        {sub.coach?.display_name?.charAt(0).toUpperCase() || '?'}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                                        {sub.coach?.display_name || 'Автор'}
                                      </p>
                                      {sub.coach?.specialization && (
                                        <p className="text-xs text-gray-500 truncate">
                                          {sub.coach.specialization}
                                        </p>
                                      )}
                                    </div>
                                  </Link>
                                  <button
                                    onClick={() => handleUnsubscribe(sub.coach_id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
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
                      Все авторы →
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
              </Card>
            </div>
          </aside>

          {/* Основной контент */}
          <main className="flex-1 min-w-0">
            {/* Все фильтры в одной строке */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 flex-wrap">
              {/* Типы контента */}
              <button
                onClick={() => setContentType('lessons')}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  contentType === 'lessons'
                    ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                Уроки
              </button>

              <button
                onClick={() => setContentType('courses')}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  contentType === 'courses'
                    ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                Курсы
              </button>

              <button
                onClick={() => {
                  setContentType('all')
                  setActiveFilter('all')
                }}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  contentType === 'all' && activeFilter === 'all'
                    ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                Все
              </button>

              {/* Остальные фильтры */}
              <button
                onClick={() => {
                  setContentType('all')
                  setActiveFilter('new')
                }}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === 'new'
                    ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                Новые
              </button>

              <button
                onClick={() => {
                  setContentType('all')
                  setActiveFilter('popular')
                }}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === 'popular'
                    ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                Популярные
              </button>

              <button
                onClick={() => {
                  setContentType('all')
                  setActiveFilter('free')
                }}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === 'free'
                    ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                Бесплатные
              </button>

              {user && (
                <button
                  onClick={() => {
                    setContentType('all')
                    setActiveFilter('subscriptions')
                  }}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeFilter === 'subscriptions'
                      ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                      : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
                  }`}
                >
                  Подписки
                </button>
              )}
            </div>

            {/* Сетка контента */}
            {displayedContent.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {activeFilter === 'subscriptions'
                    ? 'Нет контента от ваших подписок'
                    : searchQuery
                      ? 'Ничего не найдено'
                      : 'Контент не найден'}
                </h2>
                <p className="text-gray-600">
                  {activeFilter === 'subscriptions'
                    ? 'Подпишитесь на авторов, чтобы видеть их контент'
                    : searchQuery
                      ? 'Попробуйте изменить запрос'
                      : 'Пока нет доступного контента'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {displayedContent.map((item) => (
                    <Card key={`${item.type}-${item.id}`} variant="glow" padding="none" className="group overflow-hidden relative">
                      <Link
                        href={`/${item.type === 'lesson' ? 'lesson' : 'course'}/${item.id}`}
                        className="block"
                      >
                        {/* Превью */}
                        <div className="aspect-video bg-gradient-to-br from-purple-100 via-indigo-50 to-blue-100 relative overflow-hidden">
                          {item.cover_image ? (
                            <img
                              src={item.cover_image}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-16 h-16 gradient-icon rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
                                {item.type === 'lesson' ? '📚' : '🎓'}
                              </div>
                            </div>
                          )}

                          {/* Тип контента — ЛЕВЫЙ ВЕРХНИЙ УГОЛ */}
                          <div className="absolute top-3 left-3">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                              item.type === 'lesson'
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                                : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white'
                            }`}>
                              {item.type === 'lesson' ? 'Урок' : 'Курс'}
                            </span>
                          </div>

                          {/* Кнопка избранного — ЛЕВЫЙ НИЖНИЙ УГОЛ */}
                          <div
                            className="absolute bottom-3 left-3 z-10"
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                            }}
                          >
                            <FavoriteButton
                              itemId={item.id}
                              itemType={item.type === 'lesson' ? 'lesson' : 'course'}
                              size="sm"
                            />
                          </div>

                          {item.is_free && (
                            <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                              Бесплатно
                            </div>
                          )}

                          {!item.is_free && item.price > 0 && (
                            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                              {item.price} ₽
                            </div>
                          )}
                        </div>

                        {/* Контент */}
                        <div className="p-5">
                          <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-purple-600 transition-colors text-base">
                            {item.title}
                          </h3>

                          {item.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                              {item.description}
                            </p>
                          )}

                          {/* Рейтинг и отзывы */}
                          {item.reviews_count > 0 && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <svg
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= Math.round(item.rating || 0)
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
                                {item.rating?.toFixed(1)} ({item.reviews_count} {item.reviews_count === 1 ? 'отзыв' : item.reviews_count < 5 ? 'отзыва' : 'отзывов'})
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-purple-100">
                            <div className="flex items-center gap-2">
                              {item.coach?.avatar_url ? (
                                <img
                                  src={item.coach.avatar_url}
                                  alt={item.coach.display_name || ''}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 gradient-icon rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                  {item.coach?.display_name?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              <span className="truncate max-w-[120px] font-medium">
                                {item.coach?.display_name || 'Автор'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {activeFilter === 'popular' && (
                                <span className="flex items-center gap-1 text-purple-600 font-medium">
                                  💬 {item.reviews_count}
                                </span>
                              )}
                              <span suppressHydrationWarning>{formatDate(item.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </Card>
                  ))}
                </div>

                {/* Кнопка «Загрузить ещё» — теперь реально показывает следующую порцию */}
                {hasMore && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => setPage(page + 1)}
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