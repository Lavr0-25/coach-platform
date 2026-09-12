'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { ChevronRight, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface Subscriber {
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  subscribed_at: string
}

// Ф3: платный подписчик — из paid_subscriptions (журнал платных подписок).
// По паре (user_id, coach_user_id) может быть несколько строк (история продлений):
// оставляем одну на пользователя — с самой поздней датой окончания периода.
interface PaidSubscriber {
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  status: string
  period_end: string
  created_at: string
}

const ITEMS_PER_PAGE = 10

export default function SubscribersPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [coachId, setCoachId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [totalSubscribers, setTotalSubscribers] = useState(0)
  const [paidSubscribers, setPaidSubscribers] = useState<PaidSubscriber[]>([])
  const [totalPaid, setTotalPaid] = useState(0)
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
        redirect('/login')
        return
      }
      
      setUser(user)

      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (coachError || !coachData) {
        console.error('Coach not found:', coachError)
        redirect('/dashboard/mentor')
        return
      }
      
      setCoachId(coachData.id)
    } catch (error) {
      console.error('Error in loadData:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubscribers = async () => {
    if (!user || !coachId) return

    setLoading(true)
    try {
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('user_id, subscribed_at')
        .eq('coach_id', user.id)
        .order('subscribed_at', { ascending: false })

      if (subsError) throw subsError

      // Ф3: платные подписки на этого ментора (только его строки — см. RLS)
      const { data: paidData, error: paidError } = await supabase
        .from('paid_subscriptions')
        .select('user_id, status, period_end, created_at')
        .eq('coach_user_id', user.id)
        .order('created_at', { ascending: false })

      if (paidError) throw paidError

      if ((!subsData || subsData.length === 0) && (!paidData || paidData.length === 0)) {
        setSubscribers([])
        setTotalSubscribers(0)
        setPaidSubscribers([])
        setTotalPaid(0)
        setLoading(false)
        return
      }

      // Профили подписчиков (бесплатных и платных) — одним запросом
      const userIds = Array.from(new Set([
        ...(subsData || []).map(s => s.user_id),
        ...(paidData || []).map(s => s.user_id),
      ]))

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || [])

      // Админы платформы в списке подписчиков лишние — отсеиваем их
      const { data: coachRoles } = await supabase
        .from('coaches')
        .select('user_id, role')
        .in('user_id', userIds)
      const adminIds = new Set(
        (coachRoles || []).filter((c: any) => c.role === 'admin').map((c: any) => c.user_id)
      )

      const allSubscribers: Subscriber[] = (subsData || [])
        .filter(s => !adminIds.has(s.user_id))
        .map(s => {
          const profile = profilesMap.get(s.user_id)
          return {
            user_id: s.user_id,
            email: profile?.email || '',
            display_name: profile?.full_name || profile?.email || 'Пользователь',
            avatar_url: profile?.avatar_url,
            subscribed_at: s.subscribed_at,
          }
        })

      // Дедупликация: на пользователя оставляем строку с поздним period_end
      const paidByUser = new Map<string, any>()
      for (const s of paidData || []) {
        const existing = paidByUser.get(s.user_id)
        if (!existing || new Date(s.period_end) > new Date(existing.period_end)) {
          paidByUser.set(s.user_id, s)
        }
      }

      const allPaid: PaidSubscriber[] = Array.from(paidByUser.values()).map(s => {
        const profile = profilesMap.get(s.user_id)
        return {
          user_id: s.user_id,
          email: profile?.email || '',
          display_name: profile?.full_name || profile?.email || 'Пользователь',
          avatar_url: profile?.avatar_url,
          status: s.status,
          period_end: s.period_end,
          created_at: s.created_at,
        }
      })

      let filtered = allSubscribers
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        filtered = filtered.filter(s => 
          s.email.toLowerCase().includes(query) || 
          (s.display_name && s.display_name.toLowerCase().includes(query))
        )
      }

      const total = filtered.length
      setTotalSubscribers(total)
      
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE
      const paginated = filtered.slice(from, to)

      setSubscribers(paginated)

      // Платные: тот же поиск, без пагинации (платных обычно на порядки меньше)
      let filteredPaid = allPaid
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        filteredPaid = filteredPaid.filter(s =>
          s.email.toLowerCase().includes(query) ||
          (s.display_name && s.display_name.toLowerCase().includes(query))
        )
      }
      setPaidSubscribers(filteredPaid)
      setTotalPaid(filteredPaid.length)
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

  // Ф3: человеческий статус платной подписки + цвет бейджа.
  // cancelled = «Отменена», но доступ у ученика сохраняется до конца периода.
  const getSubscriptionStatus = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Активна', className: 'bg-green-100 text-green-700' }
      case 'cancelled':
        return { label: 'Отменена', className: 'bg-amber-100 text-amber-700' }
      case 'expired':
        return { label: 'Истекла', className: 'bg-gray-200 text-gray-500' }
      case 'pending':
        return { label: 'Ожидает оплаты', className: 'bg-gray-200 text-gray-500' }
      default:
        return { label: status, className: 'bg-gray-200 text-gray-500' }
    }
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
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />

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
            className="w-full px-5 py-3 pl-12 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-[box-shadow,border-color,background-color,color]"
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
            <Card key={i} variant="glow" padding="none" className="p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : subscribers.length === 0 && paidSubscribers.length === 0 ? (
        <Card variant="glow" padding="none" className="p-12 text-center">
          <div className="mb-4 flex justify-center"><Users className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
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
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {subscribers.map((subscriber) => (
              // Карточка целиком — ссылка на публичный профиль ученика
              <Link
                key={subscriber.user_id}
                href={`/mentor/${subscriber.user_id}`}
                className="block group"
              >
                <Card variant="glow" padding="none" className="p-4 hover:shadow-md transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {subscriber.avatar_url ? (
                          <Image
                            src={subscriber.avatar_url}
                            alt={subscriber.display_name || ''}
                            width={56}
                            height={56}
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

                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-1 transition-[transform,color] flex-shrink-0 ml-4" strokeWidth={1.5} />
                  </div>
                </Card>
              </Link>
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

      {/* Ф3: Платные подписчики — из paid_subscriptions (подписка на автора) */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">
            <Users className="w-5 h-5" strokeWidth={1.5} />
          </span>
          Платные подписчики
          {totalPaid > 0 && <span className="text-base text-gray-500 font-semibold">({totalPaid})</span>}
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Ученики с платной подпиской на ваши материалы. Отменённая подписка даёт доступ до конца оплаченного периода.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} variant="glow" padding="none" className="p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : paidSubscribers.length === 0 ? (
          <Card variant="glow" padding="none" className="p-8 text-center">
            <p className="text-gray-600">Пока нет платных подписчиков</p>
            <p className="text-sm text-gray-500 mt-1">
              Задайте цену подписки в разделе «Профиль → Настройки» — ученики смогут оформлять её на вашей странице
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {paidSubscribers.map((subscriber) => {
              const badge = getSubscriptionStatus(subscriber.status)
              return (
                // Карточка целиком — ссылка на публичный профиль ученика
                <Link
                  key={subscriber.user_id}
                  href={`/mentor/${subscriber.user_id}`}
                  className="block group"
                >
                  <Card variant="glow" padding="none" className="p-4 hover:shadow-md transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {subscriber.avatar_url ? (
                            <Image
                              src={subscriber.avatar_url}
                              alt={subscriber.display_name || ''}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(subscriber.display_name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                            {subscriber.display_name || 'Пользователь'}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">{subscriber.email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Подписка с {formatDate(subscriber.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-sm text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
                          Оплачено до {formatDate(subscriber.period_end)}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-1 transition-[transform,color] flex-shrink-0" strokeWidth={1.5} />
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}