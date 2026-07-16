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
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const currentCoachId = coachData?.id

      const newNotifications: Notification[] = []
      const userIds = new Set<string>()

      const { data: lessonComments, error: lessonError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (lessonError) {
        console.error('Ошибка загрузки комментариев к урокам:', lessonError)
      } else {
        for (const comment of lessonComments || []) {
          if (comment.user_id) userIds.add(comment.user_id)
        }
      }

      const { data: courseComments, error: courseError } = await supabase
        .from('course_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (courseError) {
        console.error('Ошибка загрузки комментариев к курсам:', courseError)
      } else {
        for (const comment of courseComments || []) {
          if (comment.user_id) userIds.add(comment.user_id)
        }
      }

      const { data: usersData } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .in('user_id', Array.from(userIds))

      const userNames = new Map<string, string>()
      usersData?.forEach((u: any) => {
        userNames.set(u.user_id, u.display_name || 'Пользователь')
      })

      for (const comment of lessonComments || []) {
        if (comment.user_id === user.id) continue

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

        if (comment.lesson_id) {
          const { data: lessonData } = await supabase
            .from('lessons')
            .select('title, coach_id')
            .eq('id', comment.lesson_id)
            .single()
          
          if (lessonData) {
            const isMyLesson = lessonData.coach_id === currentCoachId

            if (isReplyToMe) {
              newNotifications.push({
                id: `lesson_${comment.id}`,
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
              newNotifications.push({
                id: `lesson_${comment.id}`,
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
      }

      for (const comment of courseComments || []) {
        if (comment.user_id === user.id) continue

        let parentUserId = null
        if (comment.parent_id) {
          const { data: parentData } = await supabase
            .from('course_comments')
            .select('user_id')
            .eq('id', comment.parent_id)
            .single()
          parentUserId = parentData?.user_id
        }

        const authorName = userNames.get(comment.user_id) || 'Пользователь'
        const isReplyToMe = parentUserId === user.id

        if (comment.course_id) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('title, coach_id')
            .eq('id', comment.course_id)
            .single()
          
          if (courseData) {
            const isMyCourse = courseData.coach_id === currentCoachId

            if (isReplyToMe) {
              newNotifications.push({
                id: `course_${comment.id}`,
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
              newNotifications.push({
                id: `course_${comment.id}`,
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

      newNotifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setNotifications(newNotifications)
      setUnreadCount(newNotifications.filter(n => !n.isRead).length)
      
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const markAsRead = async (notificationId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (notificationId.startsWith('lesson_')) {
      const commentId = notificationId.replace('lesson_', '')
      await supabase
        .from('comments')
        .update({ is_read: true })
        .eq('id', commentId)
    } else if (notificationId.startsWith('course_')) {
      const commentId = notificationId.replace('course_', '')
      await supabase
        .from('course_comments')
        .update({ is_read: true })
        .eq('id', commentId)
    }

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

    const lessonChannel = supabase
      .channel('lesson-comments-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
        loadNotifications()
      })
      .subscribe()

    const courseChannel = supabase
      .channel('course-comments-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'course_comments' }, () => {
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
      supabase.removeChannel(lessonChannel)
      supabase.removeChannel(courseChannel)
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
        className="relative p-2 rounded-xl hover:bg-purple-50 transition-all group"
        title="Уведомления"
      >
        <div className="w-6 h-6 gradient-icon rounded-lg p-1 flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-purple-100 z-50 max-h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Уведомления</h3>
              {unreadCount > 0 && (
                <button onClick={loadNotifications} className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                  Обновить
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mb-2"></div>
                  <p className="text-sm">Загрузка...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-3 gradient-icon rounded-full p-2">
                    <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-sm">Нет новых уведомлений</p>
                </div>
              ) : (
                <div className="divide-y divide-purple-50">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={`${notification.link}#${notification.anchorId}`}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block p-4 hover:bg-purple-50/50 transition-colors ${
                        !notification.isRead ? 'bg-gradient-to-r from-purple-50/50 to-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          !notification.isRead ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-gray-300'
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

            {notifications.length > 0 && (
              <div className="p-3 border-t border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
                <Link
                  href="/notifications"
                  className="text-center text-sm text-purple-600 hover:text-purple-700 font-medium block"
                  onClick={() => setIsOpen(false)}
                >
                  Все уведомления →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}