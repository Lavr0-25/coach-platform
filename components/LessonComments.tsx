'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId !== null) {
      loadComments()
    }
  }, [userId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
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

      <div className="space-y-6">
        {comments.map((comment: Comment) => (
          <div key={comment.id} className="border-b pb-6 last:border-0">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {getUserInitial(comment.user_id)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {getUserName(comment.user_id)}
                    </p>
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
                  </div>
                </div>
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>

            {userId && (
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
                          <p className="font-medium text-gray-900 text-sm">
                            {getUserName(reply.user_id)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(reply.created_at)}
                          </p>
                        </div>
                        {reply.user_id === userId && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                      <p className="text-gray-700 mt-1 text-sm whitespace-pre-wrap">
                        {reply.content}
                      </p>
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