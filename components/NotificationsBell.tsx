'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Notification {
  id: string
  type: 'lesson_comment' | 'course_comment'
  title: string
  content: string
  authorName: string
  createdAt: string
  isRead: boolean
  link: string
  anchorId: string
}

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      console.log('🔔 Загрузка уведомлений для пользователя:', user.id)

      // Загружаем все комментарии
      const { data: comments, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('❌ Ошибка загрузки комментариев:', error)
        throw error
      }

      console.log(`📥 Загружено комментариев: ${comments?.length || 0}`)

      const newNotifications: Notification[] = []
      const userIds = new Set<string>()

      // Собираем все user_id для загрузки имен
      for (const comment of comments || []) {
        if (comment.user_id) userIds.add(comment.user_id)
      }

      // Загружаем имена пользователей
      const { data: usersData } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .in('user_id', Array.from(userIds))

      const userNames = new Map<string, string>()
      usersData?.forEach((u: any) => {
        userNames.set(u.user_id, u.display_name || 'Пользователь')
      })

      for (const comment of comments || []) {
        // Пропускаем собственные комментарии
        if (comment.user_id === user.id) continue

        // Получаем данные о родительском комментарии
        let parentUserId = null
        if (comment.parent_id) {
          const { data: parentData } = await supabase
            .from('comments')
            .select('user_id')
            .eq('id', comment.parent_id)
            .single()
          parentUserId = parentData?.user_id
        }

        const authorName = userNames.get(comment.user_id) || 'Пользователь'
        const isReplyToMe = parentUserId === user.id

        // Проверяем: это комментарий к уроку?
        if (comment.lesson_id) {
          const { data: lessonData } = await supabase
            .from('lessons')
            .select('title, coach_id')
            .eq('id', comment.lesson_id)
            .single()
          
          if (lessonData) {
            const isMyLesson = lessonData.coach_id === user.id
            console.log(`  📚 Урок "${lessonData.title}", coach_id: ${lessonData.coach_id}, isMyLesson: ${isMyLesson}`)

            if (isReplyToMe) {
              console.log('✅ Найдено: ответ на мой комментарий к уроку')
              newNotifications.push({
                id: comment.id,
                type: 'lesson_comment',
                title: 'Новый ответ на ваш комментарий',
                content: comment.content,
                authorName: authorName,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/lesson/${comment.lesson_id}`,
                anchorId: `comment-${comment.id}`
              })
            } else if (isMyLesson && !comment.parent_id) {
              console.log('✅ Найдено: комментарий к моему уроку')
              newNotifications.push({
                id: comment.id,
                type: 'lesson_comment',
                title: `Новый комментарий к уроку "${lessonData.title}"`,
                content: comment.content,
                authorName: authorName,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/lesson/${comment.lesson_id}`,
                anchorId: `comment-${comment.id}`
              })
            }
          }
        }

        // Проверяем: это комментарий к курсу? (если есть поле course_id)
        if (comment.course_id) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('title, coach_id')
            .eq('id', comment.course_id)
            .single()
          
          if (courseData) {
            const isMyCourse = courseData.coach_id === user.id
            console.log(`  📖 Курс "${courseData.title}", coach_id: ${courseData.coach_id}, isMyCourse: ${isMyCourse}`)

            if (isReplyToMe) {
              console.log('✅ Найдено: ответ на мой комментарий к курсу')
              newNotifications.push({
                id: comment.id,
                type: 'course_comment',
                title: 'Новый ответ на ваш комментарий',
                content: comment.content,
                authorName: authorName,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/course/${comment.course_id}`,
                anchorId: `comment-${comment.id}`
              })
            } else if (isMyCourse && !comment.parent_id) {
              console.log('✅ Найдено: комментарий к моему курсу')
              newNotifications.push({
                id: comment.id,
                type: 'course_comment',
                title: `Новый комментарий к курсу "${courseData.title}"`,
                content: comment.content,
                authorName: authorName,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/course/${comment.course_id}`,
                anchorId: `comment-${comment.id}`
              })
            }
          }
        }
      }

      // Сортируем по дате
      newNotifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      console.log(` Всего уведомлений: ${newNotifications.length}`)
      console.log(`📪 Непрочитанных: ${newNotifications.filter(n => !n.isRead).length}`)

      setNotifications(newNotifications)
      setUnreadCount(newNotifications.filter(n => !n.isRead).length)
      
    } catch (error) {
      console.error('❌ Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const markAsRead = async (notificationId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('comments')
      .update({ is_read: true })
      .eq('id', notificationId)

    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Только что'
    if (minutes < 60) return `${minutes} мин. назад`
    if (hours < 24) return `${hours} ч. назад`
    if (days < 7) return `${days} дн. назад`
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel('comments-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
        console.log('🔔 Новое сообщение в comments, обновляем уведомления...')
        loadNotifications()
      })
      .subscribe()

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [loadNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Уведомления"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border z-50 max-h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Уведомления</h3>
              {unreadCount > 0 && (
                <button onClick={loadNotifications} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Обновить
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm">Загрузка...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-sm">Нет новых уведомлений</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={`${notification.link}#${notification.anchorId}`}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block p-4 hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          !notification.isRead ? 'bg-blue-600' : 'bg-gray-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.authorName}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}