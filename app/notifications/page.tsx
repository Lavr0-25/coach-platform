'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'lesson_comment' | 'course_comment'
  title: string
  content: string
  authorName: string
  authorId: string
  createdAt: string
  isRead: boolean
  link: string
  anchorId: string
  tableName: 'comments' | 'course_comments'
  commentId: string
}

type FilterType = 'all' | 'lesson_comment' | 'course_comment'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)
    setIsLoading(true)

    try {
      const newNotifications: Notification[] = []
      const userIds = new Set<string>()

      // 1. Загружаем комментарии к урокам
      const { data: lessonComments } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      for (const comment of lessonComments || []) {
        if (comment.user_id) userIds.add(comment.user_id)
      }

      // 2. Загружаем комментарии к курсам
      const { data: courseComments } = await supabase
        .from('course_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      for (const comment of courseComments || []) {
        if (comment.user_id) userIds.add(comment.user_id)
      }

      // 3. Загружаем имена пользователей
      const { data: usersData } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .in('user_id', Array.from(userIds))

      const userNames = new Map<string, string>()
      usersData?.forEach((u: any) => {
        userNames.set(u.user_id, u.display_name || 'Пользователь')
      })

      // 4. Обрабатываем комментарии к урокам
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
            const isMyLesson = lessonData.coach_id === user.id

            if (isReplyToMe) {
              newNotifications.push({
                id: `lesson_${comment.id}`,
                type: 'lesson_comment',
                title: 'Новый ответ на ваш комментарий',
                content: comment.content,
                authorName,
                authorId: comment.user_id,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/lesson/${comment.lesson_id}`,
                anchorId: `comment-${comment.id}`,
                tableName: 'comments',
                commentId: comment.id
              })
            } else if (isMyLesson && !comment.parent_id) {
              newNotifications.push({
                id: `lesson_${comment.id}`,
                type: 'lesson_comment',
                title: `Новый комментарий к уроку "${lessonData.title}"`,
                content: comment.content,
                authorName,
                authorId: comment.user_id,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/lesson/${comment.lesson_id}`,
                anchorId: `comment-${comment.id}`,
                tableName: 'comments',
                commentId: comment.id
              })
            }
          }
        }
      }

      // 5. Обрабатываем комментарии к курсам
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
            const isMyCourse = courseData.coach_id === user.id

            if (isReplyToMe) {
              newNotifications.push({
                id: `course_${comment.id}`,
                type: 'course_comment',
                title: 'Новый ответ на ваш комментарий',
                content: comment.content,
                authorName,
                authorId: comment.user_id,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/course/${comment.course_id}`,
                anchorId: `comment-${comment.id}`,
                tableName: 'course_comments',
                commentId: comment.id
              })
            } else if (isMyCourse && !comment.parent_id) {
              newNotifications.push({
                id: `course_${comment.id}`,
                type: 'course_comment',
                title: `Новый комментарий к курсу "${courseData.title}"`,
                content: comment.content,
                authorName,
                authorId: comment.user_id,
                createdAt: comment.created_at,
                isRead: comment.is_read || false,
                link: `/course/${comment.course_id}`,
                anchorId: `comment-${comment.id}`,
                tableName: 'course_comments',
                commentId: comment.id
              })
            }
          }
        }
      }

      // Сортируем по дате
      newNotifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setNotifications(newNotifications)
      setFilteredNotifications(newNotifications)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Фильтрация
  useEffect(() => {
    if (filter === 'all') {
      setFilteredNotifications(notifications)
    } else {
      setFilteredNotifications(notifications.filter(n => n.type === filter))
    }
  }, [filter, notifications])

  const markAsRead = async (notification: Notification) => {
    await supabase
      .from(notification.tableName)
      .update({ is_read: true })
      .eq('id', notification.commentId)

    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    )
  }

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead)
    
    for (const notification of unreadNotifications) {
      await supabase
        .from(notification.tableName)
        .update({ is_read: true })
        .eq('id', notification.commentId)
    }

    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const deleteNotification = async (notification: Notification) => {
    if (!confirm('Удалить это уведомление?')) return

    await supabase
      .from(notification.tableName)
      .delete()
      .eq('id', notification.commentId)

    setNotifications(prev => prev.filter(n => n.id !== notification.id))
  }

  const deleteAllRead = async () => {
    if (!confirm('Удалить все прочитанные уведомления?')) return

    const readNotifications = notifications.filter(n => n.isRead)
    
    for (const notification of readNotifications) {
      await supabase
        .from(notification.tableName)
        .delete()
        .eq('id', notification.commentId)
    }

    setNotifications(prev => prev.filter(n => !n.isRead))
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
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const groupByDate = (notifications: Notification[]) => {
    const groups: { [key: string]: Notification[] } = {}
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    for (const notification of notifications) {
      const date = new Date(notification.createdAt)
      let group = ''

      if (date >= today) {
        group = 'Сегодня'
      } else if (date >= yesterday) {
        group = 'Вчера'
      } else if (date >= weekAgo) {
        group = 'На этой неделе'
      } else {
        group = 'Ранее'
      }

      if (!groups[group]) groups[group] = []
      groups[group].push(notification)
    }

    return groups
  }

  const groupedNotifications = groupByDate(filteredNotifications)
  const unreadCount = notifications.filter(n => !n.isRead).length

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Шапка */}
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>
        
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Уведомления</h1>
            <p className="text-gray-600 mt-1">
              {unreadCount > 0 
                ? `У вас ${unreadCount} непрочитанных уведомлений` 
                : 'Нет непрочитанных уведомлений'}
            </p>
          </div>

          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Отметить все как прочитанные
              </button>
            )}
            {notifications.filter(n => n.isRead).length > 0 && (
              <button
                onClick={deleteAllRead}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Удалить прочитанные
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('lesson_comment')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'lesson_comment' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            К урокам ({notifications.filter(n => n.type === 'lesson_comment').length})
          </button>
          <button
            onClick={() => setFilter('course_comment')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'course_comment' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            К курсам ({notifications.filter(n => n.type === 'course_comment').length})
          </button>
        </div>
      </div>

      {/* Список уведомлений */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filter === 'all' ? 'Нет уведомлений' : 'Нет уведомлений этой категории'}
          </h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'У вас пока нет уведомлений' 
              : 'В этой категории пока нет уведомлений'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([groupName, groupNotifications]) => (
            <div key={groupName}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {groupName}
              </h2>
              <div className="space-y-2">
                {groupNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`bg-white rounded-xl shadow-sm border p-4 transition-all hover:shadow-md ${
                      !notification.isRead ? 'border-l-4 border-l-blue-600 bg-blue-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Иконка */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'lesson_comment' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-purple-100 text-purple-600'
                      }`}>
                        {notification.type === 'lesson_comment' ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        )}
                      </div>

                      {/* Содержимое */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Link
                            href={`${notification.link}#${notification.anchorId}`}
                            onClick={() => markAsRead(notification)}
                            className="flex-1"
                          >
                            <h3 className={`font-semibold ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h3>
                            <p className="text-gray-600 mt-1 line-clamp-2">
                              {notification.content}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                              <span className="font-medium">{notification.authorName}</span>
                              <span>•</span>
                              <span>{formatTime(notification.createdAt)}</span>
                            </div>
                          </Link>

                          {/* Кнопка удаления */}
                          <button
                            onClick={() => deleteNotification(notification)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="Удалить уведомление"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}