'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import EmojiPicker from '@/components/EmojiPicker'
import { useMobileChat } from '@/components/MessagesLayoutShell'
import { useToast } from '@/components/Toast'

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
        supabase.from('lessons').select('id, title').eq('id', lessonId).maybeSingle().then(({ data }) => {
          if (data) setLessonInfo({ id: lessonId, title: data.title, type: 'lesson' })
        })
      } else if (courseMatch) {
        const courseId = courseMatch[1]
        supabase.from('courses').select('id, title').eq('id', courseId).maybeSingle().then(({ data }) => {
          if (data) setLessonInfo({ id: courseId, title: data.title, type: 'course' })
        })
      }
    }
  }, [content])

  if (lessonInfo) {
    const href = lessonInfo.type === 'lesson' ? `/lesson/${lessonInfo.id}` : `/course/${lessonInfo.id}`
    const textWithoutUrl = content.replace(/https?:\/\/[^\s]+/, '').trim()

    return (
      <div className="space-y-2">
        {textWithoutUrl && <p className="break-words">{textWithoutUrl}</p>}
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
          target="_blank"
        >
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
              className="text-purple-200 hover:underline break-all"
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
  const toast = useToast()
  const { setIsMobileChatOpen } = useMobileChat()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<any>(null)
  const [otherIsCoach, setOtherIsCoach] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedBy, setBlockedBy] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Устанавливаем isMobileChatOpen при загрузке чата
  useEffect(() => {
    setIsMobileChatOpen(true)
    return () => setIsMobileChatOpen(false)
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

        // Каскад имени/аватара: сначала coaches (авторы), иначе profiles (студенты)
        const { data: coach } = await supabase.from('coaches').select('*').eq('user_id', userId).maybeSingle()
        if (!mounted) return
        if (coach) {
          setOtherUser(coach)
          setOtherIsCoach(true)
        } else {
          const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', userId).maybeSingle()
          if (!mounted) return
          if (profile) setOtherUser({ display_name: profile.full_name, avatar_url: profile.avatar_url })
        }

        const { data: iBlockedHim } = await supabase.from('blocked_users').select('id').eq('blocker_id', user.id).eq('blocked_id', userId).maybeSingle()
        const { data: heBlockedMe } = await supabase.from('blocked_users').select('id').eq('blocker_id', userId).eq('blocked_id', user.id).maybeSingle()

        if (!mounted) return

        const blocked = !!iBlockedHim
        const blockedByOther = !!heBlockedMe

        setIsBlocked(blocked)
        setBlockedBy(blockedByOther)

        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true })

        if (!mounted) return

        if (msgs) {
          // Границу «Непрочитанные» считаем ДО пометки прочитанными
          const unreadCount = msgs.filter(m => m.sender_id === userId && !m.is_read).length
          if (unreadCount > 0) {
            const idx = msgs.findIndex(m => m.sender_id === userId && !m.is_read)
            setFirstUnreadIndex(idx)
          } else {
            setFirstUnreadIndex(null)
          }

          if (!blocked && !blockedByOther && unreadCount > 0) {
            const unreadIds = msgs.filter((m: any) => m.sender_id === userId && !m.is_read).map((m: any) => m.id)
            await supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
            // Уведомления об этом диалоге в колокольчике прочитаны вместе с сообщениями
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('type', 'new_message')
              .eq('link', `/messages/${userId}`)
            window.dispatchEvent(new CustomEvent('messages-read', { detail: { userId } }))
          }

          setMessages(blocked || blockedByOther ? [] : msgs)
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Error:', error)
        if (mounted) setIsLoading(false)
      }
    }

    loadData()
    return () => { mounted = false }
  }, [userId])

  // Реагируем на новые входящие сообщения, пока чат открыт
  useEffect(() => {
    if (!currentUser || isBlocked || blockedBy) return

    const channel = supabase
      .channel(`chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        if (msg.sender_id !== userId || msg.receiver_id !== currentUser.id) return
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
        supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => {
          window.dispatchEvent(new CustomEvent('messages-read', { detail: { userId } }))
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser, userId, isBlocked, blockedBy])

  const autoGrow = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px' // ~5 строк
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter — отправить; Shift+Enter — новая строка (как в мессенджерах)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as unknown as React.FormEvent)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    if (blockedBy) {
      toast.showToast('Вы не можете отправлять сообщения - вас заблокировали', 'info')
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
    requestAnimationFrame(autoGrow)

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: currentUser.id, receiver_id: userId, content: messageContent, is_read: false })
      .select()
      .single()

    if (error) {
      console.error('Ошибка отправки:', error)
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id))
      toast.showToast('Ошибка при отправке сообщения', 'error')
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempMessage.id ? data : m))
    }
  }

  const handleDelete = async (messageId: string) => {
    if (!confirm('Удалить сообщение?')) return
    const deleted = messages.find(m => m.id === messageId)
    if (!deleted) return

    await supabase.from('messages').delete().eq('id', messageId)
    setMessages(prev => prev.filter(m => m.id !== messageId))

    // Undo: возвращаем сообщение тем же содержимым в течение 5 секунд
    toast.showActionToast('Сообщение удалено', 'Вернуть', async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ sender_id: deleted.sender_id, receiver_id: deleted.receiver_id, content: deleted.content, is_read: deleted.is_read })
        .select()
        .single()
      if (!error && data) {
        setMessages(prev => [...prev.filter(m => m.id !== data.id), data].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ))
      }
    })
  }

  const handleBlockUser = async () => {
    if (!confirm('Заблокировать этого пользователя? Вы не сможете получать от него сообщений.')) return
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: currentUser.id, blocked_id: userId })
    if (error) {
      toast.showToast('Ошибка при блокировке пользователя', 'error')
      return
    }
    setIsBlocked(true)
    setMessages([])
  }

  const handleUnblockUser = async () => {
    if (!confirm('Разблокировать этого пользователя?')) return
    const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', currentUser.id).eq('blocked_id', userId)
    if (error) {
      toast.showToast('Ошибка при разблокировке', 'error')
      return
    }
    setIsBlocked(false)
    setBlockedBy(false)
    const { data: msgs } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true })
    if (msgs) setMessages(msgs)
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    // Сравниваем календарные дни (не «24 часа назад»: иначе поздно-вечернее
    // вчерашнее сообщение показывается как «Сегодня» и разделители ломаются)
    const day = date.toDateString()
    if (day === now.toDateString()) return 'Сегодня'
    if (day === new Date(now.getTime() - 86400000).toDateString()) return 'Вчера'
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  const filteredMessages = searchQuery.trim().length >= 2
    ? messages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (isBlocked || blockedBy) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isBlocked ? `Вы заблокировали ${otherUser?.display_name || 'этого пользователя'}` : `${otherUser?.display_name || 'Этот пользователь'} заблокировал вас`}
          </h2>
          <p className="text-gray-600 mb-6">Вы не можете отправлять сообщения этому пользователю</p>
          {isBlocked && (
            <button onClick={handleUnblockUser} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
              Разблокировать
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Шапка чата — единственная на мобильном (кнопка «‹» внутри) */}
      <div className="bg-white border-b border-purple-100 px-3 md:px-4 flex items-center gap-2 md:gap-4 flex-shrink-0 h-[64px] md:h-[72px]">
        <button
          onClick={() => setIsMobileChatOpen(false)}
          className="md:hidden p-2 -ml-1 text-gray-600 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="К списку диалогов"
          aria-label="К списку диалогов"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
          {otherUser?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherUser.avatar_url}
              alt={otherUser.display_name || 'Собеседник'}
              className="w-10 h-10 rounded-full object-cover border border-purple-100 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <h2 className="font-semibold text-gray-900 text-base md:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
            {otherUser?.display_name || 'Пользователь'}
          </h2>
        </div>

        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          {isSearchOpen ? (
            <div className="relative w-40 sm:w-56 md:w-64">
              <input
                type="text"
                placeholder="Поиск по чату..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 pl-9 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 text-sm transition-[box-shadow,border-color,background-color,color]"
              />
              <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Очистить поиск"><X className="w-5 h-5" /></button>
              ) : (
                <button onClick={() => { setIsSearchOpen(false); setSearchQuery('') }} className="absolute -right-8 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600" aria-label="Закрыть поиск"><X className="w-5 h-5" /></button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Поиск по чату"
              aria-label="Поиск по чату"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}

          {/* Деструктивные действия — только в меню «⋯» */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Ещё"
              aria-label="Меню чата"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-xl shadow-lg border border-purple-100 py-1.5 animate-in fade-in zoom-in duration-150">
                  {/* Профиль есть только у наставников (/mentor); у студентов
                      публичной страницы пока нет (бэклог №19) — пункт скрываем */}
                  {otherIsCoach && (
                    <Link
                      href={`/mentor/${userId}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Профиль собеседника
                    </Link>
                  )}
                  {isBlocked ? (
                    <button
                      onClick={() => { setIsMenuOpen(false); handleUnblockUser() }}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                      Разблокировать
                    </button>
                  ) : (
                    <button
                      onClick={() => { setIsMenuOpen(false); handleBlockUser() }}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      Заблокировать
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gray-50/50">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            {searchQuery ? 'Ничего не найдено' : 'Нет сообщений'}
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isMyMessage = msg.sender_id === currentUser?.id
            const prevMsg = filteredMessages[index - 1]
            const nextMsg = filteredMessages[index + 1]
            const showDate = !prevMsg || formatDate(prevMsg.created_at) !== formatDate(msg.created_at)
            // Группировка: подряд идущие сообщения одного автора — время только у последнего
            const isLastOfGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id ||
              formatDate(nextMsg.created_at) !== formatDate(msg.created_at)

            return (
              <div key={msg.id}>
                {showDate && !searchQuery && (
                  <div className="text-center my-4">
                    <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* Разделитель «Непрочитанные» */}
                {firstUnreadIndex === index && !searchQuery && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-purple-300" />
                    <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Непрочитанные</span>
                    <div className="flex-1 h-px bg-purple-300" />
                  </div>
                )}

                <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} ${isLastOfGroup ? 'mb-2' : 'mb-0.5'} group`}>
                  <div className={`max-w-[85%] md:max-w-[70%] px-4 ${isLastOfGroup ? 'py-2' : 'py-1.5'} rounded-2xl relative ${
                    isMyMessage ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-sm' : 'bg-white border border-purple-100 rounded-bl-sm shadow-sm'
                  }`}>
                    <MessageContent content={msg.content} />
                    {isLastOfGroup && (
                      <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                        isMyMessage ? 'text-purple-100' : 'text-gray-500'
                      }`}>
                        <span className="flex-shrink-0">{formatTime(msg.created_at)}</span>
                        {isMyMessage && <span className="flex-shrink-0">{msg.is_read ? '✓✓' : '✓'}</span>}
                      </div>
                    )}

                    {isMyMessage && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-white/70 hover:text-red-300 transition-opacity"
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

      {/* Поле ввода: textarea с авто-ростом */}
      <form onSubmit={handleSend} className="bg-white border-t border-purple-100 p-3 md:p-4 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); autoGrow() }}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            className="flex-1 px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 min-w-0 resize-none bg-gray-50 text-sm leading-relaxed transition-[box-shadow,border-color,background-color,color]"
          />

          {/* Эмодзи-пикер: СКРЫТ НА МОБИЛЬНЫХ */}
          <div className="hidden md:block">
            <EmojiPicker onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
          </div>

          {/* Кнопка-самолётик ВЕЗДЕ */}
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="gradient-btn text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex-shrink-0 h-[46px] w-[46px] flex items-center justify-center shadow-lg shadow-purple-500/20"
            title="Отправить"
          >
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}