'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { checkBannedWords } from '@/lib/banned-words'

interface UserInfo {
  id: string
  display_name: string
}

interface Comment {
  id: string
  user_id: string
  lesson_id: string
  parent_id: string | null
  content: string
  is_private: boolean
  created_at: string
  report_count?: number
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
  const [banThreshold, setBanThreshold] = useState(3)
  const [banDuration, setBanDuration] = useState(5)
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [updating, setUpdating] = useState(false)
  
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId !== null) {
      loadComments()
      checkBanStatus()
      loadSettings()
    }
  }, [userId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
  }

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['auto_ban_threshold', 'auto_ban_duration_days'])
      
      if (data) {
        const threshold = data.find(d => d.key === 'auto_ban_threshold')
        const duration = data.find(d => d.key === 'auto_ban_duration_days')
        if (threshold?.value) setBanThreshold(parseInt(threshold.value))
        if (duration?.value) setBanDuration(parseInt(duration.value))
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const checkBanStatus = async () => {
    if (!userId) return
    
    try {
      const { data } = await supabase
        .from('stop_list')
        .select('*')
        .eq('user_id', userId)
        .gte('banned_until', new Date().toISOString())
        .single()
      
      setIsBanned(!!data)
    } catch (error) {
      console.error('Error checking ban:', error)
    }
  }

  const loadUserInfo = async (userIds: string[]) => {
    if (userIds.length === 0) return

    const uniqueIds = [...new Set(userIds)]
    const usersInfo: Record<string, UserInfo> = {}

    for (const uid of uniqueIds) {
      try {
        const { data: coach } = await supabase
          .from('coaches')
          .select('display_name, user_id')
          .eq('user_id', uid)
          .single()

        usersInfo[uid] = {
          id: uid,
          display_name: coach?.display_name || 'Пользователь'
        }
      } catch (error) {
        usersInfo[uid] = { id: uid, display_name: 'Пользователь' }
      }
    }

    setUsersMap(prev => ({ ...prev, ...usersInfo }))
  }

  // Надёжная функция подсчёта жалоб
  const getReportCount = async (commentId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('comment_id', commentId)
      
      if (error) {
        console.error('Error counting reports:', error)
        return 0
      }
      return data?.length || 0
    } catch (error) {
      return 0
    }
  }

  const loadComments = async () => {
    try {
      console.log('🔄 Загрузка комментариев для урока:', lessonId)
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('lesson_id', lessonId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Ошибка загрузки комментариев:', error)
        throw error
      }

      console.log('📥 Найдено комментариев:', data?.length || 0)

      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment: Comment) => {
          const { data: replies } = await supabase
            .from('comments')
            .select('*')
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true })
          
          // Получаем счётчик жалоб
          const reportCount = await getReportCount(comment.id)
          console.log(`  💬 Комментарий ${comment.id.substring(0, 8)}... — жалоб: ${reportCount}`)
          
          const repliesWithCounts = await Promise.all(
            (replies || []).map(async (reply) => {
              const replyReportCount = await getReportCount(reply.id)
              return { ...reply, report_count: replyReportCount }
            })
          )
          
          return { 
            ...comment, 
            report_count: reportCount,
            replies: repliesWithCounts 
          }
        })
      )

      console.log('✅ Загружено комментариев:', commentsWithReplies.length)
      setComments(commentsWithReplies)

      const allUserIds: string[] = [
        ...(data || []).map((c: Comment) => c.user_id),
        ...(data || []).flatMap((c: Comment) => c.replies?.map((r: Comment) => r.user_id) || [])
      ]
      await loadUserInfo(allUserIds)
    } catch (error) {
      console.error('❌ Error loading comments:', error)
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

    const { hasBanned, foundWord } = await checkBannedWords(content)
    if (hasBanned) {
      alert(`⛔ Комментарий содержит запрещённое слово: "${foundWord}". Пожалуйста, измените текст.`)
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

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) {
      alert('Комментарий не может быть пустым')
      return
    }

    const { hasBanned, foundWord } = await checkBannedWords(editContent)
    if (hasBanned) {
      alert(`⛔ Комментарий содержит запрещённое слово: "${foundWord}".`)
      return
    }

    setUpdating(true)

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId)

      if (error) throw error

      setEditingCommentId(null)
      setEditContent('')
      await loadComments()
      alert('✅ Комментарий обновлён')
    } catch (error: any) {
      console.error('Error updating comment:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось обновить комментарий'))
    } finally {
      setUpdating(false)
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
      
      if (editingCommentId === commentId) {
        setEditingCommentId(null)
        setEditContent('')
      }
      
      await loadComments()
    } catch (error: any) {
      console.error('Error deleting comment:', error)
      alert('Ошибка при удалении')
    }
  }

  const handleReport = async (commentId: string, reportedUserId: string) => {
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
          reported_user_id: reportedUserId,
          comment_id: commentId,
          reason: reportReason.trim(),
          lesson_id: lessonId,
        })

      if (reportError) {
        if (reportError.code === '23505') {
          alert('⚠️ Вы уже жаловались на этот комментарий')
        } else {
          throw reportError
        }
        return
      }

      // Перезагружаем комментарии для обновления счётчика
      await loadComments()

      const newCount = await getReportCount(commentId)

      if (newCount >= banThreshold) {
        alert(`⚠️ Жалоба отправлена. Комментарий будет удалён автоматически (${newCount}/${banThreshold})`)
      } else {
        alert(`✅ Жалоба отправлена (${newCount}/${banThreshold})`)
      }

      setReportingCommentId(null)
      setReportReason('')
    } catch (error: any) {
      console.error('Error reporting:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось отправить жалобу'))
    } finally {
      setReporting(false)
    }
  }

  const toggleExpand = (commentId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
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
              ⛔ Вам запрещено оставлять комментарии. Попробуйте позже.
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
                   Личное сообщение (видит только ментор)
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
        {comments.map((comment: Comment) => {
          const isExpanded = expandedComments[comment.id] !== false
          const hasReplies = comment.replies && comment.replies.length > 0
          
          return (
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {comment.is_private && (
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                          🔒 Личное
                        </span>
                      )}
                      
                      {comment.report_count !== undefined && comment.report_count > 0 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          comment.report_count >= banThreshold 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          ⚠️ {comment.report_count}/{banThreshold}
                        </span>
                      )}
                      
                      {comment.user_id === userId && (
                        <>
                          <button
                            onClick={() => handleEditComment(comment)}
                            className="text-blue-600 hover:text-blue-700 text-xs"
                          >
                            ✏️ Редактировать
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            ️ Удалить
                          </button>
                        </>
                      )}
                      {comment.user_id !== userId && (
                        <button
                          onClick={() => setReportingCommentId(
                            reportingCommentId === comment.id ? null : comment.id
                          )}
                          className="text-gray-400 hover:text-orange-600 text-xs flex items-center gap-1"
                        >
                          🚩 Жалоба
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {editingCommentId === comment.id ? (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <textarea
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateComment(comment.id)}
                          disabled={updating}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {updating ? 'Сохранение...' : '💾 Сохранить'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingCommentId(null)
                            setEditContent('')
                          }}
                          className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm font-medium hover:bg-gray-200"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}

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
                          onClick={() => handleReport(comment.id, comment.user_id)}
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
                  {replyTo === comment.id ? 'Отмена' : '↩️ Ответить'}
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

              {hasReplies && (
                <div className="mt-4 ml-13 pl-4 border-l-2 border-gray-200">
                  <button
                    onClick={() => toggleExpand(comment.id)}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
                  >
                    {isExpanded ? '▼' : '▶'} 
                    Ответы ({comment.replies!.length})
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-4">
                      {comment.replies!.map((reply: Comment) => (
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
                                {reply.report_count !== undefined && reply.report_count > 0 && (
                                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                                    reply.report_count >= banThreshold 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    ⚠️ {reply.report_count}/{banThreshold}
                                  </span>
                                )}
                                
                                {reply.user_id === userId && (
                                  <>
                                    <button
                                      onClick={() => handleEditComment(reply)}
                                      className="text-blue-600 hover:text-blue-700 text-xs"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDelete(reply.id)}
                                      className="text-red-600 hover:text-red-700 text-xs"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                                {reply.user_id !== userId && (
                                  <button
                                    onClick={() => setReportingCommentId(
                                      reportingCommentId === reply.id ? null : reply.id
                                    )}
                                    className="text-gray-400 hover:text-orange-600 text-xs"
                                  >
                                    🚩
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {editingCommentId === reply.id ? (
                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <textarea
                                  rows={2}
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleUpdateComment(reply.id)}
                                    disabled={updating}
                                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-400"
                                  >
                                    {updating ? '...' : '💾 Сохранить'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(null)
                                      setEditContent('')
                                    }}
                                    className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium hover:bg-gray-200"
                                  >
                                    Отмена
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-700 mt-1 text-sm whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            )}

                            {reportingCommentId === reply.id && (
                              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                <textarea
                                  rows={2}
                                  value={reportReason}
                                  onChange={(e) => setReportReason(e.target.value)}
                                  className="w-full px-2 py-1 border border-orange-300 rounded-md text-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                                  placeholder="Причина жалобы..."
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleReport(reply.id, reply.user_id)}
                                    disabled={reporting}
                                    className="bg-orange-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-orange-700 disabled:bg-gray-400"
                                  >
                                    {reporting ? '...' : 'Отправить'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReportingCommentId(null)
                                      setReportReason('')
                                    }}
                                    className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium hover:bg-gray-200"
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
              )}
            </div>
          )
        })}

        {comments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            💬 Пока нет комментариев. Будьте первым!
          </div>
        )}
      </div>
    </div>
  )
}