'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setIsLoading(false)
        return
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      const currentCoachId = coachData?.id
      const newNotifications: Notification[] = []
      const userIds = new Set<string>()

      const { data: lessonComments } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      for (const comment of lessonComments || []) {
        if (comment.user_id) userIds.add(comment.user_id)
      }

      const { data: courseComments } = await supabase
        .from('course_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      for (const comment of courseComments || []) {
        if (comment.user_id) userIds.add(comment.user_id)
      }

      const { data: usersData } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .in('user_id', Array.from(userIds))

      const userNames = new Map<string, string>()
      usersData?.forEach((u: any) => {
        userNames.set(u.user_id, u.display_name || 'Пользователь')
      })

      // Обработка комментариев к урокам
      for (const comment of lessonComments || []) {
        if (comment.user_id === user.id) continue
        
        let parentUserId = null
        if (comment.parent_id) {
          const { data: parentData } = await supabase
            .from('comments')
            .select('user_id')
            .eq('id', comment.parent_id)
            .maybeSingle()
          parentUserId = parentData?.user_id
        }

        const authorName = userNames.get(comment.user_id) || 'Пользователь'
        const isReplyToMe = parentUserId === user.id

        if (comment.lesson_id) {
          const { data: lessonData } = await supabase
            .from('lessons')
            .select('title, coach_id')
            .eq('id', comment.lesson_id)
            .maybeSingle()
          
          if (lessonData) {
            const isMyLesson = lessonData.coach_id === currentCoachId

            if (isReplyToMe || (isMyLesson && !comment.parent_id)) {
              newNotifications.push({
                id: `lesson_${comment.id}`,
                type: 'lesson_comment',
                title: isReplyToMe ? 'Новый ответ на ваш комментарий' : `Новый комментарий к уроку "${lessonData.title}"`,
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

      // Обработка комментариев к курсам
      for (const comment of courseComments || []) {
        if (comment.user_id === user.id) continue
        
        let parentUserId = null
        if (comment.parent_id) {
          const { data: parentData } = await supabase
            .from('course_comments')
            .select('user_id')
            .eq('id', comment.parent_id)
            .maybeSingle()
          parentUserId = parentData?.user_id
        }

        const authorName = userNames.get(comment.user_id) || 'Пользователь'
        const isReplyToMe = parentUserId === user.id

        if (comment.course_id) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('title, coach_id')
            .eq('id', comment.course_id)
            .maybeSingle()
          
          if (courseData) {
            const isMyCourse = courseData.coach_id === currentCoachId

            if (isReplyToMe || (isMyCourse && !comment.parent_id)) {
              newNotifications.push({
                id: `course_${comment.id}`,
                type: 'course_comment',
                title: isReplyToMe ? 'Новый ответ на ваш комментарий' : `Новый комментарий к курсу "${courseData.title}"`,
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

      const displayedNotifications = newNotifications.slice(0, 10)
      
      setNotifications(displayedNotifications)
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

    try {
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
    } catch (error) {
      console.error('Error marking as read:', error)
    }
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
    
    //  УБРАЛИ Realtime подписки - они вызывают ошибки longpooling
    // Вместо этого уведомления обновляются при открытии dropdown

    return () => {
      // Cleanup не нужен, так как нет подписок
    }
  }, [loadNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
    setIsOpen(false)
  }

  const handleClick = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
    
    if (isMobile) {
      router.push('/notifications')
    } else {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        className="relative p-2 rounded-xl text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
        title="Уведомления"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-purple-100 z-50 overflow-hidden hidden sm:flex flex-col">
            
            <div className="p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Уведомления</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={loadNotifications} 
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
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
                  <div className="w-12 h-12 mx-auto mb-3 gradient-icon rounded-full p-2.5 opacity-80">
                    <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">Нет новых уведомлений</p>
                </div>
              ) : (
                <div className="divide-y divide-purple-50">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={`${notification.link}#${notification.anchorId}`}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block p-4 hover:bg-purple-50/50 transition-colors ${
                        !notification.isRead ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          !notification.isRead ? 'bg-purple-600' : 'bg-gray-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium leading-snug ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-gray-500 flex-shrink-0 whitespace-nowrap ml-2">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-snug">
                            {notification.content}
                          </p>
                          <p className="text-xs text-purple-600 mt-1.5 font-medium">
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
                  className="text-center text-sm text-purple-600 hover:text-purple-800 font-semibold block py-1 transition-colors"
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