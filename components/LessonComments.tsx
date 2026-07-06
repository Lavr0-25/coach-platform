'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { checkBannedWords } from '@/lib/banned-words'

interface UserInfo {
  id: string
  display_name: string
  email?: string
}

interface Comment {
  id: string
  user_id: string
  lesson_id: string
  parent_id: string | null
  content: string
  is_private: boolean
  created_at: string
  replies?: Comment[]
}

interface LessonCommentsProps {
  lessonId: string
}

export default function LessonComments({ lessonId }: LessonCommentsProps) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({})
  const [newComment, setNewComment] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [isBanned, setIsBanned] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId !== null) {
      loadComments()
      checkBanStatus()
    }
  }, [userId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
  }

  const checkBanStatus = async () => {
    if (!userId) return
    
    const { data } = await supabase
      .from('stop_list')
      .select('*')
      .eq('user_id', userId)
      .gte('banned_until', new Date().toISOString())
      .single()
    
    setIsBanned(!!data)
  }

  const loadUserInfo = async (userIds: string[]) => {
    if (userIds.length === 0) return

    const uniqueIds = [...new Set(userIds)]
    const usersInfo: Record<string, UserInfo> = {}

    for (const uid of uniqueIds) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('display_name, user_id')
        .eq('user_id', uid)
        .single()

      if (coach) {
        usersInfo[uid] = {
          id: uid,
          display_name: coach.display_name || 'Пользователь'
        }
      } else {
        usersInfo[uid] = {
          id: uid,
          display_name: 'Пользователь'
        }
      }
    }

    setUsersMap(prev => ({ ...prev, ...usersInfo }))
  }

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('lesson_id', lessonId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment: Comment) => {
          const { data: replies } = await supabase
            .from('comments')
            .select('*')
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true })
          
          return { ...comment, replies: replies || [] }
        })
      )

      setComments(commentsWithReplies)

      const allUserIds: string[] = [
        ...(data || []).map((c: Comment) => c.user_id),
        ...(data || []).flatMap((c: Comment) => c.replies?.map((r: Comment) => r.user_id) || [])
      ]
      await loadUserInfo(allUserIds)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault()
    
    const content = parentId ? replyContent : newComment
    if (!content.trim() || !userId) return

    if (isBanned) {
      alert('⛔ Вам запрещено оставлять комментарии. Попробуйте позже.')
      return
    }

    // Проверяем на запрещённые слова
    const { hasBanned, foundWord } = await checkBannedWords(content)
    if (hasBanned) {
      alert(` Комментарий содержит запрещённое слово: "${foundWord}". Пожалуйста, измените текст.`)
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          parent_id: parentId,
          content: content.trim(),
          is_private: parentId ? false : isPrivate,
        })

      if (error) throw error

      setNewComment('')
      setReplyContent('')
      setReplyTo(null)
      setIsPrivate(false)
      await loadComments()
    } catch (error: any) {
      console.error('Error posting comment:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось отправить комментарий'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Удалить комментарий?')) return

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
      await loadComments()
    } catch (error: any) {
      console.error('Error deleting comment:', error)
      alert('Ошибка при удалении')
    }
  }

  const handleReport = async (commentId: string) => {
    if (!userId) {
      alert('Войдите, чтобы пожаловаться')
      return
    }

    if (!reportReason.trim()) {
      alert('Укажите причину жалобы')
      return
    }

    setReporting(true)

    try {
      const { data: comment } = await supabase
        .from('comments')
        .select('*')
        .eq('id', commentId)
        .single()

      if (!comment) throw new Error('Комментарий не найден')

      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          reporter_id: userId,
          reported_user_id: comment.user_id,
          comment_id: commentId,
          reason: reportReason.trim(),
          lesson_id: lessonId,
        })

      if (reportError) throw reportError

      const { data: reports } = await supabase
        .from('reports')
        .select('id')
        .eq('comment_id', commentId)

      const reportCount = reports?.length || 0

      if (reportCount >= 3) {
        await supabase
          .from('comments')
          .delete()
          .eq('id', commentId)

        const banUntil = new Date()
        banUntil.setDate(banUntil.getDate() + 5)

        await supabase
          .from('stop_list')
          .upsert({
            user_id: comment.user_id,
            reason: 'Автоматическая блокировка: 3+ жалобы на комментарий',
            banned_until: banUntil.toISOString(),
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          })

        alert('⚠️ Комментарий удалён из-за множественных жалоб. Пользователь заблокирован на 5 дней.')
      } else {
        alert(`✅ Жалоба отправлена. (${reportCount}/3)`)
      }

      setReportingCommentId(null)
      setReportReason('')
      await loadComments()
    } catch (error: any) {
      console.error('Error reporting:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось отправить жалобу'))
    } finally {
      setReporting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUserName = (userId: string) => {
    return usersMap[userId]?.display_name || 'Пользователь'
  }

  const getUserInitial = (userId: string) => {
    const name = getUserName(userId)
    return name.charAt(0).toUpperCase()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        💬 Комментарии ({comments.length})
      </h2>

      {userId ? (
        isBanned ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800 font-medium">
               Вам запрещено оставлять комментарии. Попробуйте позже.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => handleSubmit(e, null)} className="mb-8 space-y-4">
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                Ваш комментарий
              </label>
              <textarea
                id="comment"
                rows={4}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Задайте вопрос или оставьте комментарий..."
                required
              />
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  🔒 Личное сообщение (видит только ментор)
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {submitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <p className="text-yellow-800">
            <Link href="/login" className="underline font-medium hover:text-yellow-900">
              Войдите
            </Link>
            , чтобы оставить комментарий
          </p>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto space-y-6 pr-2">
        {comments.map((comment: Comment) => (
          <div key={comment.id} className="border-b pb-6 last:border-0">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {getUserInitial(comment.user_id)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <Link
                      href={`/profile/${comment.user_id}`}
                      className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {getUserName(comment.user_id)}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {formatDate(comment.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {comment.is_private && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                        🔒 Личное
                      </span>
                    )}
                    {comment.user_id === userId && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Удалить
                      </button>
                    )}
                    {comment.user_id !== userId && (
                      <button
                        onClick={() => setReportingCommentId(
                          reportingCommentId === comment.id ? null : comment.id
                        )}
                        className="text-gray-400 hover:text-orange-600 text-sm flex items-center gap-1"
                        title="Пожаловаться"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8a2 2 0 012-2h11l3-3v13a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-xs">Жалоба</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                  {comment.content}
                </p>

                {reportingCommentId === comment.id && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-900 mb-2">
                      Причина жалобы:
                    </p>
                    <textarea
                      rows={2}
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 border border-orange-300 rounded-md text-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Опишите причину жалобы..."
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleReport(comment.id)}
                        disabled={reporting}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-orange-700 disabled:bg-gray-400"
                      >
                        {reporting ? 'Отправка...' : 'Отправить жалобу'}
                      </button>
                      <button
                        onClick={() => {
                          setReportingCommentId(null)
                          setReportReason('')
                        }}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm font-medium hover:bg-gray-200"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {userId && !isBanned && (
              <button
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-13"
              >
                {replyTo === comment.id ? 'Отмена' : 'Ответить'}
              </button>
            )}

            {replyTo === comment.id && userId && (
              <form
                onSubmit={(e) => handleSubmit(e, comment.id)}
                className="mt-4 ml-13 space-y-3"
              >
                <textarea
                  rows={3}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ваш ответ..."
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  >
                    {submitting ? 'Отправка...' : 'Ответить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null)
                      setReplyContent('')
                    }}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}

            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-4 space-y-4 ml-13 pl-4 border-l-2 border-gray-200">
                {comment.replies.map((reply: Comment) => (
                  <div key={reply.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {getUserInitial(reply.user_id)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <Link
                            href={`/profile/${reply.user_id}`}
                            className="font-medium text-blue-600 hover:text-blue-700 hover:underline text-sm"
                          >
                            {getUserName(reply.user_id)}
                          </Link>
                          <p className="text-xs text-gray-500">
                            {formatDate(reply.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {reply.user_id === userId && (
                            <button
                              onClick={() => handleDelete(reply.id)}
                              className="text-red-600 hover:text-red-700 text-xs"
                            >
                              Удалить
                            </button>
                          )}
                          {reply.user_id !== userId && (
                            <button
                              onClick={() => setReportingCommentId(
                                reportingCommentId === reply.id ? null : reply.id
                              )}
                              className="text-gray-400 hover:text-orange-600 text-xs flex items-center gap-1"
                              title="Пожаловаться"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8a2 2 0 012-2h11l3-3v13a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              </svg>
                              <span>Жалоба</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 mt-1 text-sm whitespace-pre-wrap">
                        {reply.content}
                      </p>

                      {reportingCommentId === reply.id && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm font-medium text-orange-900 mb-2">
                            Причина жалобы:
                          </p>
                          <textarea
                            rows={2}
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="w-full px-3 py-2 border border-orange-300 rounded-md text-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                            placeholder="Опишите причину жалобы..."
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleReport(reply.id)}
                              disabled={reporting}
                              className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-orange-700 disabled:bg-gray-400"
                            >
                              {reporting ? 'Отправка...' : 'Отправить жалобу'}
                            </button>
                            <button
                              onClick={() => {
                                setReportingCommentId(null)
                                setReportReason('')
                              }}
                              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm font-medium hover:bg-gray-200"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {comments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            💬 Пока нет комментариев. Будьте первым!
          </div>
        )}
      </div>
    </div>
  )
}