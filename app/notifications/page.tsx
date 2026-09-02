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
      // 🔥 ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ВСЕХ ДАННЫХ ОДНОВРЕМЕННО
      const [
        coachData,
        lessonComments,
        courseComments
      ] = await Promise.all([
        supabase.from('coaches').select('id').eq('user_id', user.id).single(),
        supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('course_comments').select('*').order('created_at', { ascending: false }).limit(50)
      ])

      const currentCoachId = coachData.data?.id
      const newNotifications: Notification[] = []
      const userIds = new Set<string>()
      const lessonIds = new Set<string>()
      const courseIds = new Set<string>()

      // Собираем все ID
      for (const comment of lessonComments.data || []) {
        if (comment.user_id) userIds.add(comment.user_id)
        if (comment.lesson_id) lessonIds.add(comment.lesson_id)
      }
      for (const comment of courseComments.data || []) {
        if (comment.user_id) userIds.add(comment.user_id)
        if (comment.course_id) courseIds.add(comment.course_id)
      }

      // 🔥 ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ВСЕХ СПРАВОЧНИКОВ
      const [usersData, lessonsData, coursesData] = await Promise.all([
        supabase.from('coaches').select('user_id, display_name').in('user_id', Array.from(userIds)),
        lessonIds.size > 0 ? supabase.from('lessons').select('id, title, coach_id').in('id', Array.from(lessonIds)) : Promise.resolve({ data: [] }),
        courseIds.size > 0 ? supabase.from('courses').select('id, title, coach_id').in('id', Array.from(courseIds)) : Promise.resolve({ data: [] })
      ])

      // Создаём Map для быстрого доступа
      const userNames = new Map<string, string>()
      usersData.data?.forEach((u: any) => {
        userNames.set(u.user_id, u.display_name || 'Пользователь')
      })

      const lessonsMap = new Map<string, any>()
      lessonsData.data?.forEach((l: any) => {
        lessonsMap.set(l.id, l)
      })

      const coursesMap = new Map<string, any>()
      coursesData.data?.forEach((c: any) => {
        coursesMap.set(c.id, c)
      })

      // Обрабатываем комментарии к урокам (БЕЗ запросов к БД!)
      for (const comment of lessonComments.data || []) {
        if (comment.user_id === user.id) continue

        let parentUserId = null
        if (comment.parent_id) {
          const parentComment = lessonComments.data?.find(c => c.id === comment.parent_id)
          parentUserId = parentComment?.user_id
        }

        const authorName = userNames.get(comment.user_id) || 'Пользователь'
        const isReplyToMe = parentUserId === user.id

        if (comment.lesson_id) {
          const lessonData = lessonsMap.get(comment.lesson_id)

          if (lessonData) {
            const isMyLesson = lessonData.coach_id === currentCoachId

            if (isReplyToMe || (isMyLesson && !comment.parent_id)) {
              newNotifications.push({
                id: `lesson_${comment.id}`,
                type: 'lesson_comment',
                title: isReplyToMe ? 'Новый ответ на ваш комментарий' : `Новый комментарий к уроку "${lessonData.title}"`,
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

      // Обрабатываем комментарии к курсам (БЕЗ запросов к БД!)
      for (const comment of courseComments.data || []) {
        if (comment.user_id === user.id) continue

        let parentUserId = null
        if (comment.parent_id) {
          const parentComment = courseComments.data?.find(c => c.id === comment.parent_id)
          parentUserId = parentComment?.user_id
        }

        const authorName = userNames.get(comment.user_id) || 'Пользователь'
        const isReplyToMe = parentUserId === user.id

        if (comment.course_id) {
          const courseData = coursesMap.get(comment.course_id)

          if (courseData) {
            const isMyCourse = courseData.coach_id === currentCoachId

            if (isReplyToMe || (isMyCourse && !comment.parent_id)) {
              newNotifications.push({
                id: `course_${comment.id}`,
                type: 'course_comment',
                title: isReplyToMe ? 'Новый ответ на ваш комментарий' : `Новый комментарий к курсу "${courseData.title}"`,
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

      if (date >= today) group = 'Сегодня'
      else if (date >= yesterday) group = 'Вчера'
      else if (date >= weekAgo) group = 'На этой неделе'
      else group = 'Ранее'

      if (!groups[group]) groups[group] = []
      groups[group].push(notification)
    }

    return groups
  }

  const groupedNotifications = groupByDate(filteredNotifications)
  const unreadCount = notifications.filter(n => !n.isRead).length

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl pt-24 md:pt-28">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-purple-100 rounded w-1/3"></div>
          <div className="h-64 bg-purple-100 rounded-2xl"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl pt-24 md:pt-28">
      <div className="mb-6">
        <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 mb-4 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Уведомления</h1>
            <p className="text-gray-600 mt-1">
              {unreadCount > 0 ? `У вас ${unreadCount} непрочитанных уведомлений` : 'Нет непрочитанных уведомлений'}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="gradient-btn text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:shadow-md transition-all">
                Прочитать все
              </button>
            )}
            {notifications.filter(n => n.isRead).length > 0 && (
              <button onClick={deleteAllRead} className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors">
                Очистить прочитанные
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-2 mb-6 flex gap-1 overflow-x-auto">
        {(['all', 'lesson_comment', 'course_comment'] as FilterType[]).map((f) => {
          const count = f === 'all' ? notifications.length : notifications.filter(n => n.type === f).length
          const labels = { all: 'Все', lesson_comment: 'К урокам', course_comment: 'К курсам' }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap flex-1 sm:flex-none text-center ${
                filter === f 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-purple-50'
              }`}
            >
              {labels[f]} {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
            </button>
          )
        })}
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 gradient-icon rounded-full p-3 opacity-80">
            <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filter === 'all' ? 'Нет уведомлений' : 'Нет уведомлений в этой категории'}
          </h3>
          <p className="text-gray-600 max-w-sm mx-auto">
            {filter === 'all' ? 'Здесь будут появляться ответы на ваши комментарии и новые отзывы.' : 'Попробуйте переключить фильтр, чтобы увидеть другие уведомления.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedNotifications).map(([groupName, groupNotifications]) => (
            <div key={groupName}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                {groupName}
              </h2>
              <div className="space-y-3">
                {groupNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`bg-white rounded-2xl shadow-sm border border-purple-100 p-4 transition-all hover:shadow-md group ${
                      !notification.isRead ? 'border-l-4 border-l-purple-600 bg-purple-50/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'lesson_comment' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
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

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`${notification.link}#${notification.anchorId}`}
                            onClick={() => markAsRead(notification)}
                            className="flex-1 group/link"
                          >
                            <h3 className={`font-semibold leading-snug group-hover/link:text-purple-600 transition-colors ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h3>
                            <p className="text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
                              {notification.content}
                            </p>
                            <div className="flex items-center gap-2 mt-2.5 text-sm">
                              <span className="font-medium text-purple-700">{notification.authorName}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-500">{formatTime(notification.createdAt)}</span>
                            </div>
                          </Link>

                          <button
                            onClick={() => deleteNotification(notification)}
                            className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Удалить"
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