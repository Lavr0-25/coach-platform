'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import EmojiPicker from '@/components/EmojiPicker'

function MessageContent({ content }: { content: string }) {
  const [lessonInfo, setLessonInfo] = useState<{ id: string; title: string; type: 'lesson' | 'course' } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const urlMatch = content.match(/https?:\/\/[^\s]+/g)
    if (urlMatch) {
      const url = urlMatch[0]
      const lessonMatch = url.match(/\/lesson\/([a-f0-9-]+)/i)
      const courseMatch = url.match(/\/course\/([a-f0-9-]+)/i)

      if (lessonMatch) {
        const lessonId = lessonMatch[1]
        supabase
          .from('lessons')
          .select('id, title')
          .eq('id', lessonId)
          .single()
          .then(({ data }) => {
            if (data) {
              setLessonInfo({ id: lessonId, title: data.title, type: 'lesson' })
            }
          })
      } else if (courseMatch) {
        const courseId = courseMatch[1]
        supabase
          .from('courses')
          .select('id, title')
          .eq('id', courseId)
          .single()
          .then(({ data }) => {
            if (data) {
              setLessonInfo({ id: courseId, title: data.title, type: 'course' })
            }
          })
      }
    }
  }, [content])

  if (lessonInfo) {
    const icon = lessonInfo.type === 'lesson' ? '🎬' : '📚'
    const href = lessonInfo.type === 'lesson' ? `/lesson/${lessonInfo.id}` : `/course/${lessonInfo.id}`
    const textWithoutUrl = content.replace(/https?:\/\/[^\s]+/, '').trim()
    
    return (
      <div className="space-y-2">
        {textWithoutUrl && (
          <p className="break-words">{textWithoutUrl}</p>
        )}
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          target="_blank"
        >
          <span className="text-lg">{icon}</span>
          <span className="font-medium text-sm">{lessonInfo.title}</span>
        </Link>
      </div>
    )
  }

  const parts = content.split(/(https?:\/\/[^\s]+)/g)
  
  return (
    <p className="break-words">
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string
  const supabase = createClient()
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedBy, setBlockedBy] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Блокируем глобальный скролл
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow
    
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  // Автопрокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        if (!mounted) return
        setCurrentUser(user)

        const { data: coach } = await supabase
          .from('coaches')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!mounted) return
        if (coach) {
          setOtherUser(coach)
        }

        const { data: iBlockedHim } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId)
          .maybeSingle()

        const { data: heBlockedMe } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', userId)
          .eq('blocked_id', user.id)
          .maybeSingle()

        if (!mounted) return

        const blocked = !!iBlockedHim
        const blockedByOther = !!heBlockedMe

        setIsBlocked(blocked)
        setBlockedBy(blockedByOther)

        if (!blocked && !blockedByOther) {
          const { data: unreadMessages, error: unreadError } = await supabase
            .from('messages')
            .select('id')
            .eq('receiver_id', user.id)
            .eq('sender_id', userId)
            .eq('is_read', false)

          if (unreadError) {
            console.error('Error loading unread messages:', unreadError)
          }

          if (unreadMessages && unreadMessages.length > 0) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({ is_read: true })
              .in('id', unreadMessages.map(m => m.id))

            if (updateError) {
              console.error('Error updating messages:', updateError)
            } else {
              window.dispatchEvent(new CustomEvent('messages-read', { 
                detail: { userId } 
              }))
            }
          }
        }

        if (blocked || blockedByOther) {
          setMessages([])
          setIsLoading(false)
          return
        }

        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true })

        if (!mounted) return
        if (msgs) {
          setMessages(msgs)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error:', error)
        if (mounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [userId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    if (blockedBy) {
      alert('Вы не можете отправлять сообщения - вас заблокировали')
      return
    }

    const messageContent = newMessage.trim()
    
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: userId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false
    }

    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        content: messageContent,
        is_read: false
      })
      .select()
      .single()

    if (error) {
      console.error('Ошибка отправки:', error)
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id))
      alert('Ошибка при отправке сообщения')
    } else if (data) {
      setMessages(prev => 
        prev.map(m => m.id === tempMessage.id ? data : m)
      )
    }
  }

  const handleDelete = async (messageId: string) => {
    if (!confirm('Удалить сообщение?')) return
    
    await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
    
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  const handleBlockUser = async () => {
    if (!confirm('Заблокировать этого пользователя? Вы не сможете получать от него сообщений.')) return

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUser.id,
          blocked_id: userId
        })

      if (error) {
        console.error('Ошибка блокировки:', error)
        alert('Ошибка при блокировке пользователя')
        return
      }

      setIsBlocked(true)
      setMessages([])
      alert('Пользователь заблокирован')
    } catch (err) {
      console.error('Error blocking user:', err)
      alert('Ошибка при блокировке')
    }
  }

  const handleUnblockUser = async () => {
    if (!confirm('Разблокировать этого пользователя?')) return

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', userId)

      if (error) {
        console.error('Ошибка разблокировки:', error)
        alert('Ошибка при разблокировке пользователя')
        return
      }

      setIsBlocked(false)
      setBlockedBy(false)
      
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })

      if (msgs) {
        setMessages(msgs)
      }
      alert('Пользователь разблокирован')
    } catch (err) {
      console.error('Error unblocking user:', err)
      alert('Ошибка при разблокировке')
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Сегодня'
    if (days === 1) return 'Вчера'
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  const filteredMessages = searchQuery.trim().length >= 2
    ? messages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isBlocked || blockedBy) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isBlocked 
              ? `Вы заблокировали ${otherUser?.display_name || 'этого пользователя'}` 
              : `${otherUser?.display_name || 'Этот пользователь'} заблокировал вас`}
          </h2>
          <p className="text-gray-600 mb-6">
            Вы не можете отправлять сообщения этому пользователю
          </p>
          {isBlocked && (
            <button
              onClick={handleUnblockUser}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Разблокировать
            </button>
          )}
          {!isBlocked && blockedBy && (
            <p className="text-sm text-gray-500">
              Только {otherUser?.display_name || 'этот пользователь'} может разблокировать вас
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    // Чат занимает всю высоту родителя
    <div className="flex flex-col h-full pt-16">
           {/* Шапка чата - фиксированная высота 72px */}
      <div className="bg-white border-b px-4 flex items-center gap-4 flex-shrink-0" style={{ height: '72px' }}>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
            {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
          <h2 className="font-semibold text-gray-900 text-lg whitespace-nowrap">
            {otherUser?.display_name || 'Пользователь'}
          </h2>
          
          <button
            onClick={handleBlockUser}
            className="ml-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Заблокировать пользователя"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 max-w-md ml-auto min-w-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск по чату..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-white">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            {searchQuery ? 'Ничего не найдено' : 'Нет сообщений'}
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isMyMessage = msg.sender_id === currentUser?.id
            const prevMsg = filteredMessages[index - 1]
            const showDate = !prevMsg || 
              formatDate(prevMsg.created_at) !== formatDate(msg.created_at)

            return (
              <div key={msg.id}>
                {showDate && !searchQuery && (
                  <div className="text-center my-4">
                    <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                )}

                <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} mb-2 group`}>
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl relative ${
                    isMyMessage ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm'
                  }`}>
                    <MessageContent content={msg.content} />
                    <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                      isMyMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <span className="flex-shrink-0">{formatTime(msg.created_at)}</span>
                      {isMyMessage && <span className="flex-shrink-0">{msg.is_read ? '✓✓' : '✓'}</span>}
                    </div>
                    
                    {isMyMessage && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-white hover:text-red-300 transition-opacity"
                        title="Удалить"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода - ВЫРАВНИВАНИЕ КНОПКИ И ПОЛЯ */}
      <form onSubmit={handleSend} className="bg-white border-t p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Сообщение..."
            className="flex-1 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 h-[46px]"
          />
          <EmojiPicker onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 h-[46px] flex items-center justify-center"
          >
            Отправить
          </button>
        </div>
      </form>
    </div>
  )
}