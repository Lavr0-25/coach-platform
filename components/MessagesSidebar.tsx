'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMobileChat } from '@/components/MessagesLayoutShell'

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

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30000

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
  const { setIsMobileChatOpen } = useMobileChat()

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
        
        const otherUser = userMap.get(otherUserId) || { 
          display_name: 'Пользователь', 
          avatar_url: null 
        }

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
          if (new Date(message.created_at).getTime() > new Date(existing.lastMessageTime).getTime()) {
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadConversations(), 500)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        cache.delete('conversations')
        debouncedLoad()
      })
      .subscribe()

    const handleMessagesRead = () => {
      cache.delete('conversations')
      debouncedLoad()
    }

    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('messages-read', handleMessagesRead)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Вчера'
    if (days < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' })
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const filteredCoaches = coaches.filter((coach: any) => {
    const name = (coach.display_name || '').toLowerCase()
    const spec = (coach.specialization || '').toLowerCase()
    return name.includes(searchQuery.toLowerCase()) || spec.includes(searchQuery.toLowerCase())
  })

  const visibleConversations = conversations.filter(conv => !hiddenConversations.includes(conv.userId))
  const hiddenConvObjects = conversations.filter(conv => hiddenConversations.includes(conv.userId))
  const hasAnyConversations = conversations.length > 0

  return (
    // ДОБАВЛЕНО: pt-16 md:pt-20 чтобы навбар не перекрывал шапку сайдбара
    <aside className="w-full md:w-80 bg-white border-r border-purple-100 flex flex-col h-full pt-16 md:pt-20">
      
      {/* Шапка сайдбара */}
      <div className="border-b border-purple-100 flex-shrink-0 bg-gradient-to-r from-purple-50 to-blue-50 flex flex-col justify-center px-4 gap-3 min-h-[80px] md:min-h-[72px]">
        <h1 className="text-xl font-bold gradient-text leading-none">Сообщения</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск наставников..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-9 pr-4 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 text-sm bg-white transition-all"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Список диалогов */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <p className="text-sm mt-2">Загрузка...</p>
          </div>
        ) : hasAnyConversations ? (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 flex items-center justify-between sticky top-0 z-10 border-b border-purple-100">
              <span>Диалоги ({visibleConversations.length})</span>
              {hiddenConversations.length > 0 && (
                <button onClick={showAllConversations} className="text-xs text-purple-600 hover:text-purple-800 font-normal normal-case">
                  Показать скрытые ({hiddenConversations.length})
                </button>
              )}
            </div>

            {visibleConversations.length > 0 ? (
              visibleConversations.map((conv) => {
                const isActive = pathname === `/messages/${conv.userId}`
                
                return (
                  <Link
                    key={conv.userId}
                    href={`/messages/${conv.userId}`}
                    onClick={() => setIsMobileChatOpen(true)}
                    className="group flex items-start gap-3 p-4 border-b border-purple-50 transition-colors relative"
                  >
                    <div className={`absolute inset-0 transition-colors ${
                      isActive 
                        ? 'bg-purple-50 border-l-4 border-l-purple-600' 
                        : conv.unreadCount > 0 
                          ? 'bg-purple-50/50 group-hover:bg-purple-100/50' 
                          : 'group-hover:bg-purple-50/30'
                    }`} />

                    <div className="relative flex-shrink-0 z-10">
                      {conv.userAvatar ? (
                        <img src={conv.userAvatar} alt={conv.userName} className="w-12 h-12 rounded-full object-cover border border-purple-100" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                          {conv.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {conv.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 z-10">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                          {conv.userName}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate flex-1 ${conv.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-purple-600 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-1.5 flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => hideConversation(conv.userId, e)}
                      className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      title="Скрыть диалог"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Link>
                )
              })
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm bg-gray-50/50 relative z-10">
                <p className="mb-2">Все диалоги скрыты</p>
                <button onClick={showAllConversations} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
                  Показать все ({hiddenConversations.length})
                </button>
              </div>
            )}

            {hiddenConvObjects.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-100/50 flex items-center justify-between sticky top-0 z-10 border-b border-purple-100">
                  <span>Скрытые ({hiddenConvObjects.length})</span>
                  <button onClick={showAllConversations} className="text-xs text-purple-600 hover:text-purple-800 font-normal normal-case">
                    Показать все
                  </button>
                </div>
                {hiddenConvObjects.map((conv) => (
                  <div key={`hidden-${conv.userId}`} className="group flex items-start gap-3 p-4 border-b border-purple-50 bg-gray-50/50 hover:bg-gray-100/50 transition-colors relative opacity-70">
                    <div className="relative flex-shrink-0 z-10">
                      {conv.userAvatar ? (
                        <img src={conv.userAvatar} alt={conv.userName} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                          {conv.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 z-10">
                      <h3 className="font-medium truncate text-gray-600">{conv.userName}</h3>
                      <p className="text-sm truncate text-gray-500">{conv.lastMessage}</p>
                    </div>
                    <button
                      onClick={(e) => unhideConversation(conv.userId, e)}
                      className="absolute top-2 right-2 p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all flex-shrink-0 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
          <div className="p-4 text-center text-gray-500 text-sm relative z-10">Нет диалогов</div>
        )}

        {/* Результаты поиска по наставникам */}
        {searchQuery && (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 sticky top-0 z-10 border-b border-purple-100">
              Наставники
            </div>
            {filteredCoaches.length > 0 ? (
              <div className="divide-y divide-purple-50">
                {filteredCoaches.map((coach: any) => {
                  const userName = coach.display_name || 'Наставник'
                  return (
                    <Link
                      key={coach.user_id}
                      href={`/messages/${coach.user_id}`}
                      onClick={() => setIsMobileChatOpen(true)}
                      className="group flex items-center gap-3 p-4 hover:bg-purple-50/50 transition-colors relative"
                    >
                      <div className="absolute inset-0 bg-purple-50/0 group-hover:bg-purple-50/50 transition-colors" />
                      {coach.avatar_url ? (
                        <img src={coach.avatar_url} alt={userName} className="w-10 h-10 rounded-full object-cover border border-purple-100 relative z-10" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold relative z-10">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 relative z-10">
                        <h3 className="font-medium text-gray-900 text-sm truncate">{userName}</h3>
                        {coach.specialization && (
                          <p className="text-xs text-gray-500 truncate">{coach.specialization}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 relative z-10">Наставники не найдены</div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}