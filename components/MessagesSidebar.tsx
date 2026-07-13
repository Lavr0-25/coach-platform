'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  userId: string
  userName: string
  userAvatar: string | null
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isOnline: boolean
}

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

interface MessagesSidebarProps {
  coaches: Coach[]
}

// Кэш для запросов
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30000 // 30 секунд

export default function MessagesSidebar({ coaches }: MessagesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hiddenConversations, setHiddenConversations] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hidden-conversations')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const supabase = createClient()
  const pathname = usePathname()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadConversations = async () => {
    const cacheKey = 'conversations'
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setConversations(cached.data)
      setIsLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data: allMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (messagesError) {
        console.error('Error loading messages:', messagesError)
        setIsLoading(false)
        return
      }

      if (!allMessages || allMessages.length === 0) {
        setConversations([])
        setIsLoading(false)
        return
      }

      const otherUserIds = new Set<string>()
      allMessages.forEach((msg: any) => {
        if (msg.sender_id !== user.id) otherUserIds.add(msg.sender_id)
        if (msg.receiver_id !== user.id) otherUserIds.add(msg.receiver_id)
      })

      const { data: coachesData } = await supabase
        .from('coaches')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(otherUserIds))

      const userMap = new Map<string, { display_name: string | null; avatar_url: string | null }>()
      coachesData?.forEach((coach: any) => {
        userMap.set(coach.user_id, {
          display_name: coach.display_name,
          avatar_url: coach.avatar_url
        })
      })

      const conversationsMap = new Map<string, Conversation>()

      for (const message of allMessages) {
        const isSender = message.sender_id === user.id
        const otherUserId = isSender ? message.receiver_id : message.sender_id
        const otherUser = userMap.get(otherUserId)

        if (!otherUser) continue

        const userName = otherUser.display_name || 'Пользователь'
        const userAvatar = otherUser.avatar_url

        const existing = conversationsMap.get(otherUserId)

        if (!existing) {
          conversationsMap.set(otherUserId, {
            userId: otherUserId,
            userName,
            userAvatar,
            lastMessage: message.content,
            lastMessageTime: message.created_at,
            unreadCount: !isSender && !message.is_read ? 1 : 0,
            isOnline: false
          })
        } else {
          if (new Date(message.created_at) > new Date(existing.lastMessageTime)) {
            existing.lastMessage = message.content
            existing.lastMessageTime = message.created_at
          }
          if (!isSender && !message.is_read) {
            existing.unreadCount += 1
          }
        }
      }

      const sortedConversations = Array.from(conversationsMap.values()).sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      })

      cache.set(cacheKey, { data: sortedConversations, timestamp: Date.now() })
      
      setConversations(sortedConversations)
      setIsLoading(false)
    } catch (err) {
      console.error('Error in loadConversations:', err)
      setIsLoading(false)
    }
  }

  const debouncedLoad = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      loadConversations()
    }, 500)
  }

  const hideConversation = (userId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const newHidden = [...hiddenConversations, userId]
    setHiddenConversations(newHidden)
    localStorage.setItem('hidden-conversations', JSON.stringify(newHidden))
  }

  const showAllConversations = () => {
    setHiddenConversations([])
    localStorage.removeItem('hidden-conversations')
  }

  const unhideConversation = (userId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newHidden = hiddenConversations.filter(id => id !== userId)
    setHiddenConversations(newHidden)
    localStorage.setItem('hidden-conversations', JSON.stringify(newHidden))
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    debouncedLoad()
  }, [pathname])

  useEffect(() => {
    const channel = supabase
      .channel('messages-sidebar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          cache.delete('conversations')
          debouncedLoad()
        }
      )
      .subscribe()

    const handleMessagesRead = () => {
      cache.delete('conversations')
      debouncedLoad()
    }

    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('messages-read', handleMessagesRead)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Вчера'
    } else if (days < 7) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    }
  }

  const filteredCoaches = coaches.filter((coach: any) => {
    const name = (coach.display_name || '').toLowerCase()
    const spec = (coach.specialization || '').toLowerCase()
    return name.includes(searchQuery.toLowerCase()) || spec.includes(searchQuery.toLowerCase())
  })

  const visibleConversations = conversations.filter(
    conv => !hiddenConversations.includes(conv.userId)
  )

  const hiddenConvObjects = conversations.filter(
    conv => hiddenConversations.includes(conv.userId)
  )

  const hasAnyConversations = conversations.length > 0

  return (
    <aside className="w-80 bg-white border-r flex flex-col h-full">
      {/* Шапка - фиксированная высота 72px, как в чате */}
      <div className="px-4 border-b flex-shrink-0 flex items-center" style={{ height: '72px' }}>
        <h1 className="text-xl font-bold text-gray-900">Сообщения</h1>
      </div>

      {/* Поиск - фиксированный */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск наставников..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Прокручиваемая область - ключевое изменение */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-sm mt-2">Загрузка...</p>
          </div>
        ) : hasAnyConversations ? (
          <>
            {/* Шапка "Диалоги" - sticky */}
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 flex items-center justify-between sticky top-0 z-10 border-b">
              <span>Диалоги ({visibleConversations.length})</span>
              {hiddenConversations.length > 0 && (
                <button
                  onClick={showAllConversations}
                  className="text-xs text-blue-600 hover:text-blue-800 font-normal normal-case"
                >
                  Показать все скрытые ({hiddenConversations.length})
                </button>
              )}
            </div>

            {visibleConversations.length > 0 ? (
              visibleConversations.map((conv) => (
                <Link
                  key={conv.userId}
                  href={`/messages/${conv.userId}`}
                  className={`flex items-start gap-3 p-4 border-b transition-colors relative ${
                    conv.unreadCount > 0 
                      ? 'bg-blue-50 hover:bg-blue-100' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {conv.userAvatar ? (
                      <img
                        src={conv.userAvatar}
                        alt={conv.userName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                        {conv.userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {conv.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-semibold truncate ${
                        conv.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-700'
                      }`}>
                        {conv.userName}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatTime(conv.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate flex-1 ${
                        conv.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-600'
                      }`}>
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-1.5 flex items-center justify-center flex-shrink-0">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => hideConversation(conv.userId, e)}
                    className="absolute top-2 right-2 opacity-0 hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 z-10"
                    title="Скрыть диалог"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Link>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm bg-gray-50">
                <p className="mb-2">Все диалоги скрыты</p>
                <button
                  onClick={showAllConversations}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Показать все ({hiddenConversations.length})
                </button>
              </div>
            )}

            {hiddenConvObjects.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-100 flex items-center justify-between sticky top-0 z-10 border-b">
                  <span>Скрытые ({hiddenConvObjects.length})</span>
                  <button
                    onClick={showAllConversations}
                    className="text-xs text-blue-600 hover:text-blue-800 font-normal normal-case"
                  >
                    Показать все
                  </button>
                </div>
                {hiddenConvObjects.map((conv) => (
                  <div
                    key={`hidden-${conv.userId}`}
                    className="flex items-start gap-3 p-4 border-b bg-gray-50 hover:bg-gray-100 transition-colors relative opacity-70"
                  >
                    <div className="relative flex-shrink-0">
                      {conv.userAvatar ? (
                        <img
                          src={conv.userAvatar}
                          alt={conv.userName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                          {conv.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate text-gray-600">
                        {conv.userName}
                      </h3>
                      <p className="text-sm truncate text-gray-500">
                        {conv.lastMessage}
                      </p>
                    </div>
                    
                    <button
                      onClick={(e) => unhideConversation(conv.userId, e)}
                      className="absolute top-2 right-2 p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all flex-shrink-0 z-10"
                      title="Вернуть диалог"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            Нет диалогов
          </div>
        )}

        {searchQuery && (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 border-b">
              Наставники
            </div>
            {filteredCoaches.length > 0 ? (
              <div className="divide-y">
                {filteredCoaches.map((coach: any) => {
                  const userName = coach.display_name || 'Наставник'
                  return (
                    <Link
                      key={coach.user_id}
                      href={`/messages/${coach.user_id}`}
                      className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                    >
                      {coach.avatar_url ? (
                        <img
                          src={coach.avatar_url}
                          alt={userName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm truncate">
                          {userName}
                        </h3>
                        {coach.specialization && (
                          <p className="text-xs text-gray-500 truncate">
                            {coach.specialization}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                Наставники не найдены
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}