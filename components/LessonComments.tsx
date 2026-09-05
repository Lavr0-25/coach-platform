'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { checkBannedWords } from '@/lib/banned-words'
import { Flag, Pencil, Trash2 } from 'lucide-react'

interface UserInfo {
  id: string
  display_name: string
}

interface Comment {
  id: string
  user_id: string
  lesson_id: string | null
  course_id: string | null
  parent_id: string | null
  content: string
  rating: number | null
  is_private: boolean
  created_at: string
  report_count?: number
  replies?: Comment[]
}

interface LessonCommentsProps {
  lessonId?: string
  courseId?: string
}

export default function LessonComments({ lessonId, courseId }: LessonCommentsProps) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({})
  const [newComment, setNewComment] = useState('')
  const [newRating, setNewRating] = useState<number | null>(null)
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
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editRating, setEditRating] = useState<number | null>(null)
  const [updating, setUpdating] = useState(false)
  
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [showReviewsOnly, setShowReviewsOnly] = useState(false)
  const [userHasReview, setUserHasReview] = useState<Comment | null>(null)

  const targetId = lessonId || courseId || ''

  useEffect(() => {
    checkUser()
  }, [])

  // 🔥 ОПТИМИЗАЦИЯ: useCallback предотвращает бесконечные циклы перерисовки
  const loadSettings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['auto_ban_threshold'])
        .maybeSingle()
      
      if (data?.value) setBanThreshold(parseInt(data.value))
    } catch (error) {
      // Игнорируем, если таблицы нет
    }
  }, [supabase])

  const checkBanStatus = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('stop_list')
        .select('*')
        .eq('user_id', userId)
        .gte('banned_until', new Date().toISOString())
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.warn('Warning checking ban:', error)
        setIsBanned(false)
        return
      }
      setIsBanned(!!data)
    } catch (error) {
      console.error('Error checking ban:', error)
      setIsBanned(false)
    }
  }, [userId, supabase])

  const checkUserReview = useCallback(async () => {
    if (!userId || !targetId) return
    try {
      let query = supabase
        .from('comments')
        .select('*')
        .eq('user_id', userId)
        .is('parent_id', null)
        .not('rating', 'is', null)

      if (lessonId) query = query.eq('lesson_id', lessonId)
      else if (courseId) query = query.eq('course_id', courseId)

      const { data } = await query.maybeSingle()
      setUserHasReview(data || null)
    } catch (error) {
      setUserHasReview(null)
    }
  }, [userId, lessonId, courseId, supabase])

  const loadUserNames = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return
    const uniqueIds = [...new Set(userIds)]
    const namesMap: Record<string, UserInfo> = {}

    try {
      const { data } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .in('user_id', uniqueIds)

      if (data) {
        data.forEach(coach => {
          namesMap[coach.user_id] = { id: coach.user_id, display_name: coach.display_name || 'Пользователь' }
        })
      }
      uniqueIds.forEach(uid => {
        if (!namesMap[uid]) namesMap[uid] = { id: uid, display_name: 'Пользователь' }
      })
      setUsersMap(prev => ({ ...prev, ...namesMap }))
    } catch (error) {
      console.error('Error loading user names:', error)
    }
  }, [supabase])

  // 🔥 ГЛАВНАЯ ОПТИМИЗАЦИЯ: Загрузка ВСЕХ данных за 3 запроса вместо N+1
  const loadComments = useCallback(async () => {
    try {
      let query = supabase
        .from('comments')
        .select('*')
        .is('parent_id', null)
        .order('created_at', { ascending: false })

      if (lessonId) query = query.eq('lesson_id', lessonId)
      else if (courseId) query = query.eq('course_id', courseId)

      const { data: commentsData, error } = await query
      if (error) throw error

      const commentsList = commentsData || []
      const commentIds = commentsList.map(c => c.id)

      // 1. Загружаем ВСЕ ответы одним запросом
      let allReplies: any[] = []
      if (commentIds.length > 0) {
        const { data: repliesData } = await supabase
          .from('comments')
          .select('*')
          .in('parent_id', commentIds)
          .order('created_at', { ascending: true })
        allReplies = repliesData || []
      }

      // 2. Загружаем ВСЕ жалобы одним запросом
      let allReports: any[] = []
      if (commentIds.length > 0) {
        const { data: reportsData } = await supabase
          .from('reports')
          .select('comment_id')
          .in('comment_id', commentIds)
        allReports = reportsData || []
      }

      // 3. Собираем данные в JavaScript (мгновенно, без запросов к БД)
      const reportCounts = new Map<string, number>()
      allReports.forEach(r => {
        reportCounts.set(r.comment_id, (reportCounts.get(r.comment_id) || 0) + 1)
      })

      const repliesMap = new Map<string, any[]>()
      allReplies.forEach(r => {
        if (!repliesMap.has(r.parent_id)) repliesMap.set(r.parent_id, [])
        repliesMap.get(r.parent_id)!.push({
          ...r,
          report_count: reportCounts.get(r.id) || 0
        })
      })

      const commentsWithReplies = commentsList.map(comment => ({
        ...comment,
        report_count: reportCounts.get(comment.id) || 0,
        replies: repliesMap.get(comment.id) || []
      }))

      setComments(commentsWithReplies)

      const allUserIds: string[] = [
        ...commentsList.map((c: Comment) => c.user_id),
        ...commentsList.flatMap((c: Comment) => c.replies?.map((r: Comment) => r.user_id) || [])
      ]
      await loadUserNames(allUserIds)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }, [lessonId, courseId, supabase, loadUserNames])

  // Комментарии видны всем (в т.ч. анонимам); бан- и отзыв-проверки — только для залогиненных
  useEffect(() => {
    loadComments()
    loadSettings()
    if (userId) {
      checkBanStatus()
      checkUserReview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lessonId, courseId])

  // Прокрутка к якорю при переходе из уведомлений
  useEffect(() => {
    const hash = window.location.hash
    if (hash && comments.length > 0) {
      setTimeout(() => {
        const element = document.querySelector(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50', 'transition-colors', 'duration-500')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50')
          }, 2500)
        }
      }, 300)
    }
  }, [comments])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
  }

  const handleSubmit = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault()
    const content = parentId ? replyContent : newComment
    if (!content.trim() || !userId) return

    if (isBanned) {
      alert('⛔ Вам запрещено оставлять комментарии.')
      return
    }

    const { hasBanned, foundWord } = await checkBannedWords(content)
    if (hasBanned) {
      alert(`⛔ Комментарий содержит запрещённое слово: "${foundWord}".`)
      return
    }

    setSubmitting(true)
    try {
      const insertData: any = {
        user_id: userId,
        parent_id: parentId,
        content: content.trim(),
        is_private: parentId ? false : isPrivate,
      }
      if (lessonId) insertData.lesson_id = lessonId
      if (courseId) insertData.course_id = courseId

      if (!parentId && newRating !== null) {
        if (userHasReview) {
          alert('⚠️ Вы уже оставляли отзыв с оценкой. Вы можете отредактировать его.')
          setSubmitting(false)
          return
        }
        insertData.rating = newRating
      }

      const { error } = await supabase.from('comments').insert(insertData)
      if (error) throw error

      setNewComment('')
      setNewRating(null)
      setReplyContent('')
      setReplyTo(null)
      setIsPrivate(false)
      await loadComments()
      await checkUserReview()
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
    setEditRating(comment.rating)
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
      const updateData: any = { content: editContent.trim() }
      const originalComment = comments.find(c => c.id === commentId)
      if (originalComment && !originalComment.parent_id) {
        updateData.rating = editRating
      }

      const { error } = await supabase.from('comments').update(updateData).eq('id', commentId)
      if (error) throw error

      setEditingCommentId(null)
      setEditContent('')
      setEditRating(null)
      await loadComments()
      await checkUserReview()
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
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) throw error
      
      if (editingCommentId === commentId) {
        setEditingCommentId(null)
        setEditContent('')
        setEditRating(null)
      }
      await loadComments()
      await checkUserReview()
    } catch (error: any) {
      console.error('Error deleting comment:', error)
      alert('Ошибка при удалении')
    }
  }

  const handleReport = async (commentId: string, reportedUserId: string) => {
    if (!userId) { alert('Войдите, чтобы пожаловаться'); return }
    if (!reportReason.trim()) { alert('Укажите причину жалобы'); return }
    setReporting(true)
    try {
      const { error: reportError } = await supabase.from('reports').insert({
        reporter_id: userId,
        reported_user_id: reportedUserId,
        comment_id: commentId,
        reason: reportReason.trim(),
        lesson_id: lessonId || null,
      })
      if (reportError) {
        if (reportError.code === '23505') alert('⚠️ Вы уже жаловались на этот комментарий')
        else throw reportError
        return
      }
      await loadComments()
      // Подсчёт жалоб теперь мгновенный из локального состояния, но для алерта сделаем запрос
      const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('comment_id', commentId)
      const newCount = count || 0
      if (newCount >= banThreshold) alert(`⚠️ Жалоба отправлена. Комментарий будет удалён автоматически (${newCount}/${banThreshold})`)
      else alert(`✅ Жалоба отправлена (${newCount}/${banThreshold})`)
      
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
    setExpandedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getUserName = (uid: string) => usersMap[uid]?.display_name || 'Пользователь'
  const getUserInitial = (uid: string) => getUserName(uid).charAt(0).toUpperCase()

  const renderStars = (rating: number | null, interactive = false, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            disabled={!interactive}
            onClick={() => interactive && setNewRating(star === rating ? null : star)}
            className={`focus:outline-none transition-transform ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <svg className={`${sizeClasses[size]} ${rating !== null && star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    )
  }

  const filteredComments = showReviewsOnly ? comments.filter(c => c.rating !== null) : comments
  const reviewsCount = comments.filter(c => c.rating !== null).length
  const averageRating = reviewsCount > 0 ? comments.filter(c => c.rating !== null).reduce((sum, c) => sum + (c.rating || 0), 0) / reviewsCount : 0

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-purple-100 rounded w-1/3"></div>
          <div className="h-20 bg-purple-100 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-purple-100 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold gradient-text flex items-center gap-2">
            <span className="text-2xl">💬</span>
            Комментарии ({comments.length})
          </h2>
          {reviewsCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1">{renderStars(Math.round(averageRating), false, 'sm')}</div>
              <span className="text-sm font-semibold text-gray-700">{averageRating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({reviewsCount} {reviewsCount === 1 ? 'отзыв' : reviewsCount < 5 ? 'отзыва' : 'отзывов'})</span>
            </div>
          )}
        </div>
        {reviewsCount > 0 && (
          <button
            onClick={() => setShowReviewsOnly(!showReviewsOnly)}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-sm ${
              showReviewsOnly ? 'gradient-btn text-white shadow-lg shadow-purple-500/30' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            {showReviewsOnly ? '✨ Показать все' : '⭐ Только отзывы'}
          </button>
        )}
      </div>

      {userId ? (
        isBanned ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">⛔ Вам запрещено оставлять комментарии.</p>
          </div>
        ) : (
          <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>💬</span><span>Оставить комментарий</span>
            </h3>
            <form onSubmit={(e) => handleSubmit(e, null)} className="space-y-4">
              {!userHasReview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Оценка (необязательно, только один раз)</label>
                  {renderStars(newRating, true, 'lg')}
                  {newRating !== null && <p className="text-xs text-purple-600 mt-1">Вы ставите оценку {newRating}/5. Это можно сделать только один раз.</p>}
                </div>
              )}
              {userHasReview && (
                <div className="bg-purple-100 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                  <p className="font-medium">⭐ Вы уже оставили отзыв с оценкой</p>
                  <p className="text-xs mt-1">Вы можете отредактировать свой отзыв в списке ниже.</p>
                </div>
              )}
              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">Ваш комментарий <span className="text-red-500">*</span></label>
                <textarea
                  id="comment" rows={4} value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color] bg-white"
                  placeholder="Задайте вопрос или оставьте комментарий..." required
                />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500" />
                  <span className="text-sm text-gray-700">🔒 Личное сообщение (видит только ментор)</span>
                </label>
                <button type="submit" disabled={submitting} className="gradient-btn text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity w-full sm:w-auto">
                  {submitting ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        )
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-yellow-800 text-sm sm:text-base">
            <Link href="/login" className="underline font-medium hover:text-yellow-900">Войдите</Link>, чтобы оставить комментарий
          </p>
        </div>
      )}

      <div className="space-y-6">
        {filteredComments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm sm:text-base">{showReviewsOnly ? 'Пока нет отзывов с оценками' : 'Пока нет комментариев. Будьте первым!'}</p>
          </div>
        ) : (
          filteredComments.map((comment: Comment) => {
            const isExpanded = expandedComments[comment.id] !== false
            const hasReplies = comment.replies && comment.replies.length > 0
            
            return (
              <div key={comment.id} id={`comment-${comment.id}`} className={`border-b border-purple-100 pb-6 last:border-0 transition-colors duration-500 ${comment.rating !== null ? 'bg-purple-50/30 rounded-xl p-4 border border-purple-200' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md">
                    {getUserInitial(comment.user_id)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <Link href={`/profile/${comment.user_id}`} className="font-medium text-purple-600 hover:text-purple-700 hover:underline">
                          {getUserName(comment.user_id)}
                          {comment.user_id === userId && <span className="ml-2 text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">вы</span>}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {comment.rating !== null && (
                            <div className="flex items-center gap-1">
                              {renderStars(comment.rating, false, 'sm')}
                              <span className="text-xs text-gray-500">({comment.rating}/5)</span>
                            </div>
                          )}
                          <p className="text-xs sm:text-sm text-gray-500">{formatDate(comment.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {comment.is_private && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">🔒 Личное</span>}
                        {comment.report_count !== undefined && comment.report_count > 0 && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${comment.report_count >= banThreshold ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                            ⚠️ {comment.report_count}/{banThreshold}
                          </span>
                        )}
                        {comment.user_id === userId ? (
                          <>
                            <button onClick={() => handleEditComment(comment)} className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 text-xs font-medium"><Pencil className="w-3.5 h-3.5" /> Редактировать</button>
                            <button onClick={() => handleDelete(comment.id)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium"><Trash2 className="w-3.5 h-3.5" /> Удалить</button>
                          </>
                        ) : (
                          <button onClick={() => setReportingCommentId(reportingCommentId === comment.id ? null : comment.id)} className="inline-flex items-center gap-1 text-gray-400 hover:text-orange-600 text-xs font-medium"><Flag className="w-3.5 h-3.5" /> Жалоба</button>
                        )}
                      </div>
                    </div>
                    
                    {editingCommentId === comment.id ? (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                        {!comment.parent_id && (
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Оценка:</label>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button key={star} type="button" onClick={() => setEditRating(star === editRating ? null : star)} className="cursor-pointer transition-transform focus:outline-none">
                                  <svg className={`w-6 h-6 ${editRating !== null && star <= editRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <textarea rows={3} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" />
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button onClick={() => handleUpdateComment(comment.id)} disabled={updating} className="gradient-btn text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow-md disabled:opacity-50">
                            {updating ? 'Сохранение...' : '💾 Сохранить'}
                          </button>
                          <button onClick={() => { setEditingCommentId(null); setEditContent(''); setEditRating(null) }} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Отмена</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-700 mt-2 whitespace-pre-wrap break-words text-sm sm:text-base">{comment.content}</p>
                    )}

                    {reportingCommentId === comment.id && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <p className="text-sm font-medium text-orange-900 mb-2">Причина жалобы:</p>
                        <textarea rows={2} value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400" placeholder="Опишите причину жалобы..." />
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button onClick={() => handleReport(comment.id, comment.user_id)} disabled={reporting} className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
                            {reporting ? 'Отправка...' : 'Отправить жалобу'}
                          </button>
                          <button onClick={() => { setReportingCommentId(null); setReportReason('') }} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Отмена</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {userId && !isBanned && (
                  <button onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} className="text-sm text-purple-600 hover:text-purple-700 font-medium ml-13 transition-colors">
                    {replyTo === comment.id ? 'Отмена' : '↩️ Ответить'}
                  </button>
                )}

                {replyTo === comment.id && userId && (
                  <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-4 ml-0 sm:ml-13 space-y-3">
                    <textarea rows={3} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className="w-full px-3 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" placeholder="Ваш ответ..." required />
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={submitting} className="gradient-btn text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md disabled:opacity-50">
                        {submitting ? 'Отправка...' : 'Ответить'}
                      </button>
                      <button type="button" onClick={() => { setReplyTo(null); setReplyContent('') }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Отмена</button>
                    </div>
                  </form>
                )}

                {hasReplies && (
                  <div className="mt-4 ml-0 sm:ml-13 pl-0 sm:pl-4 border-l-2 border-purple-100">
                    <button onClick={() => toggleExpand(comment.id)} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1 font-medium">
                      {isExpanded ? '▼' : '▶'} Ответы ({comment.replies!.length})
                    </button>
                    {isExpanded && (
                      <div className="space-y-4">
                        {comment.replies!.map((reply: Comment) => (
                          <div key={reply.id} id={`comment-${reply.id}`} className="flex items-start gap-3 transition-colors duration-500">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                              {getUserInitial(reply.user_id)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <Link href={`/profile/${reply.user_id}`} className="font-medium text-purple-600 hover:text-purple-700 hover:underline text-sm">
                                    {getUserName(reply.user_id)}
                                  </Link>
                                  <p className="text-xs text-gray-500">{formatDate(reply.created_at)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {reply.report_count !== undefined && reply.report_count > 0 && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${reply.report_count >= banThreshold ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                      ⚠️ {reply.report_count}/{banThreshold}
                                    </span>
                                  )}
                                  {reply.user_id === userId ? (
                                    <>
                                      <button onClick={() => handleEditComment(reply)} className="inline-flex text-purple-600 hover:text-purple-700 text-xs"><Pencil className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleDelete(reply.id)} className="inline-flex text-red-600 hover:text-red-700 text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </>
                                  ) : (
                                    <button onClick={() => setReportingCommentId(reportingCommentId === reply.id ? null : reply.id)} className="text-gray-400 hover:text-orange-600 text-xs">🚩</button>
                                  )}
                                </div>
                              </div>
                              {editingCommentId === reply.id ? (
                                <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-xl">
                                  <textarea rows={2} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full px-2 py-1 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" />
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <button onClick={() => handleUpdateComment(reply.id)} disabled={updating} className="gradient-btn text-white px-3 py-1 rounded text-xs font-medium shadow-sm disabled:opacity-50">
                                      {updating ? '...' : '💾 Сохранить'}
                                    </button>
                                    <button onClick={() => { setEditingCommentId(null); setEditContent(''); setEditRating(null) }} className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-200">Отмена</button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-700 mt-1 text-sm whitespace-pre-wrap break-words">{reply.content}</p>
                              )}
                              {reportingCommentId === reply.id && (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-xl">
                                  <textarea rows={2} value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full px-2 py-1 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400" placeholder="Причина жалобы..." />
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <button onClick={() => handleReport(reply.id, reply.user_id)} disabled={reporting} className="bg-orange-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-orange-700 disabled:opacity-50">
                                      {reporting ? '...' : 'Отправить'}
                                    </button>
                                    <button onClick={() => { setReportingCommentId(null); setReportReason('') }} className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-200">Отмена</button>
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
          })
        )}
      </div>
    </div>
  )
}