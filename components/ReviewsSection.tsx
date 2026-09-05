'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { checkBannedWords } from '@/lib/banned-words'
import { useToast } from '@/components/Toast'

interface Review {
  id: string
  user_id: string
  course_id: string | null
  lesson_id: string | null
  rating: number
  comment: string | null
  created_at: string
  report_count?: number
}

interface ReviewsSectionProps {
  courseId?: string
  lessonId?: string
}

export default function ReviewsSection({ courseId, lessonId }: ReviewsSectionProps) {
  const toast = useToast()
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState<number>(0)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [banThreshold, setBanThreshold] = useState(3)
  const [isBanned, setIsBanned] = useState(false)
  const [banInfo, setBanInfo] = useState<{ until: string; reason: string } | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId !== null) {
      loadReviews()
      loadSettings()
      checkBanStatus()
    }
  }, [userId, courseId, lessonId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
  }

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', 'auto_ban_threshold')
        .maybeSingle()
      
      if (data?.value) {
        setBanThreshold(parseInt(data.value))
      }
    } catch (error) {
      // Игнорируем, если таблицы настроек нет
    }
  }

  // 🔥 ИСПРАВЛЕНИЕ: Безопасная проверка бана без ошибок 406
  const checkBanStatus = async () => {
    if (!userId) return
    
    try {
      const { data, error } = await supabase
        .from('stop_list')
        .select('*')
        .eq('user_id', userId)
        .gte('banned_until', new Date().toISOString())
        .maybeSingle() // ✅ Возвращает null, если не найдено, вместо ошибки
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.warn('Warning checking ban status:', error)
        setIsBanned(false)
        setBanInfo(null)
        return
      }
      
      if (data) {
        setIsBanned(true)
        setBanInfo({
          until: data.banned_until,
          reason: data.reason || 'Нарушение правил',
        })
      } else {
        setIsBanned(false)
        setBanInfo(null)
      }
    } catch (error) {
      console.error('Error checking ban status:', error)
      // При любой ошибке считаем, что пользователь не забанен
      setIsBanned(false)
      setBanInfo(null)
    }
  }

  const loadUserNames = async (userIds: string[]) => {
    if (userIds.length === 0) return

    const uniqueIds = [...new Set(userIds)]
    const namesMap: Record<string, string> = {}

    try {
      const { data } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .in('user_id', uniqueIds)

      if (data) {
        data.forEach(coach => {
          namesMap[coach.user_id] = coach.display_name || 'Пользователь'
        })
      }
      
      uniqueIds.forEach(uid => {
        if (!namesMap[uid]) namesMap[uid] = 'Пользователь'
      })

      setUsersMap(prev => ({ ...prev, ...namesMap }))
    } catch (error) {
      console.error('Error loading user names:', error)
    }
  }

  const loadReviews = async () => {
    setLoading(true)

    try {
      let query = supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) // 🔥 ОПТИМИЗАЦИЯ: загружаем только последние 50 отзывов для скорости

      if (courseId) {
        query = query.eq('course_id', courseId)
      } else if (lessonId) {
        query = query.eq('lesson_id', lessonId)
      }

      const { data, error } = await query
      if (error) throw error

      const reviewsList = data || []
      
      const reviewsWithReports = await Promise.all(
        reviewsList.map(async (review) => {
          const { count } = await supabase
            .from('review_reports')
            .select('*', { count: 'exact', head: true })
            .eq('review_id', review.id)
          
          return { ...review, report_count: count || 0 }
        })
      )

      setReviews(reviewsWithReports)

      const userIds = reviewsWithReports.map(r => r.user_id)
      await loadUserNames(userIds)

      if (reviewsWithReports.length > 0) {
        const avg = reviewsWithReports.reduce((sum, r) => sum + r.rating, 0) / reviewsWithReports.length
        setAverageRating(Math.round(avg * 10) / 10)
      } else {
        setAverageRating(0)
      }

      if (userId) {
        const found = reviewsWithReports.find(r => r.user_id === userId)
        if (found) {
          setUserReview(found)
          setNewRating(found.rating)
          setNewComment(found.comment || '')
        } else {
          setUserReview(null)
          setNewRating(5)
          setNewComment('')
        }
      }
    } catch (error) {
      console.error('Error loading reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userId) {
      toast.showToast('Войдите, чтобы оставить отзыв', 'info')
      return
    }

    if (isBanned) {
      toast.showToast(`Вы заблокированы до ${banInfo ? new Date(banInfo.until).toLocaleString('ru-RU') : ''}. Причина: ${banInfo?.reason || 'Нарушение правил'}`, 'error')
      return
    }

    if (newComment.trim()) {
      const { hasBanned, foundWord } = await checkBannedWords(newComment)
      if (hasBanned) {
        toast.showToast(`Отзыв содержит запрещённое слово: "${foundWord}". Пожалуйста, измените текст.`, 'error')
        return
      }
    }

    setSubmitting(true)

    try {
      const reviewData = {
        user_id: userId,
        course_id: courseId || null,
        lesson_id: lessonId || null,
        rating: newRating,
        comment: newComment.trim() || null,
      }

      const { error } = await supabase
        .from('reviews')
        .upsert(reviewData, {
          onConflict: courseId 
            ? 'user_id,course_id' 
            : 'user_id,lesson_id'
        })

      if (error) throw error

      await loadReviews()
      toast.showToast('Отзыв сохранён!', 'success')
    } catch (error: any) {
      console.error('Error saving review:', error)
      toast.showToast('Ошибка: ' + (error.message || 'Не удалось сохранить отзыв'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (review: Review) => {
    setUserReview(review)
    setNewRating(review.rating)
    setNewComment(review.comment || '')
    window.scrollTo({ top: document.querySelector('form')?.getBoundingClientRect().top! + window.scrollY - 100, behavior: 'smooth' })
  }

  const handleDelete = async () => {
    if (!userReview) return
    if (!confirm('Удалить отзыв?')) return

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', userReview.id)

      if (error) throw error

      await loadReviews()
      setUserReview(null)
      setNewComment('')
      toast.showToast('Отзыв удалён', 'info')
    } catch (error: any) {
      console.error('Error deleting review:', error)
      toast.showToast('Ошибка при удалении отзыва', 'error')
    }
  }

  const handleReport = async (reviewId: string, reportedUserId: string) => {
    if (!userId) {
      toast.showToast('Войдите, чтобы пожаловаться', 'info')
      return
    }

    if (!reportReason.trim()) {
      toast.showToast('Укажите причину жалобы', 'info')
      return
    }

    setReporting(true)

    try {
      const { error: reportError } = await supabase
        .from('review_reports')
        .insert({
          reporter_id: userId,
          reported_user_id: reportedUserId,
          review_id: reviewId,
          reason: reportReason.trim(),
        })

      if (reportError) {
        if (reportError.code === '23505') {
          toast.showToast('Вы уже жаловались на этот отзыв', 'error')
        } else {
          throw reportError
        }
        return
      }

      const { count } = await supabase
        .from('review_reports')
        .select('*', { count: 'exact', head: true })
        .eq('review_id', reviewId)

      const reportCount = count || 0

      if (reportCount >= banThreshold) {
        toast.showToast(`️ Жалоба отправлена. Отзыв будет удалён автоматически (${reportCount}/${banThreshold})`, 'info')
      } else {
        toast.showToast(`Жалоба отправлена (${reportCount}/${banThreshold})`, 'success')
      }

      setReportingReviewId(null)
      setReportReason('')
      await loadReviews()
    } catch (error: any) {
      console.error('Error reporting:', error)
      toast.showToast('Ошибка: ' + (error.message || 'Не удалось отправить жалобу'), 'error')
    } finally {
      setReporting(false)
    }
  }

  const renderStars = (rating: number, interactive = false, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-7 h-7'
    }

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            disabled={!interactive}
            onClick={() => interactive && setNewRating(star)}
            className={`focus:outline-none transition-transform ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <svg
              className={`${sizeClasses[size]} ${
                star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              }`}
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    )
  }

  const getReviewsWord = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'отзыв'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'отзыва'
    return 'отзывов'
  }

  const getUserName = (review: Review) => {
    return usersMap[review.user_id] || 'Пользователь'
  }

  const getUserInitial = (review: Review) => {
    const name = getUserName(review)
    return name.charAt(0).toUpperCase()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-purple-100 rounded w-1/3"></div>
          <div className="h-24 bg-purple-100 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-purple-100 gap-4">
        <h2 className="text-xl sm:text-2xl font-bold gradient-text flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          Отзывы и рейтинги
        </h2>
        
        {reviews.length > 0 && (
          <div className="flex items-center gap-3 bg-purple-50/50 px-4 py-2 rounded-xl">
            <div className="text-2xl font-bold text-gray-900">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex flex-col">
              {renderStars(Math.round(averageRating), false, 'sm')}
              <span className="text-xs text-gray-500 mt-0.5">
                {reviews.length} {getReviewsWord(reviews.length)}
              </span>
            </div>
          </div>
        )}
      </div>

      {userId ? (
        isBanned ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">
              ⛔ Вы заблокированы до {banInfo ? new Date(banInfo.until).toLocaleString('ru-RU') : ''}
            </p>
            <p className="text-red-700 text-sm mt-1">
              Причина: {banInfo?.reason || 'Нарушение правил'}
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-4 sm:p-5 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {userReview ? '✏️ Редактировать отзыв' : '⭐ Оставьте отзыв'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ваша оценка <span className="text-red-500">*</span>
                </label>
                {renderStars(newRating, true, 'lg')}
              </div>

              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                  Комментарий
                </label>
                <textarea
                  id="comment"
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color] bg-white"
                  placeholder="Поделитесь впечатлениями..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="gradient-btn text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity w-full sm:w-auto"
                >
                  {submitting ? 'Сохранение...' : userReview ? ' Обновить отзыв' : '✅ Опубликовать отзыв'}
                </button>
                
                {userReview && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="bg-white border border-red-200 text-red-600 px-6 py-2.5 rounded-xl font-medium hover:bg-red-50 transition-colors w-full sm:w-auto"
                  >
                    ️ Удалить
                  </button>
                )}
              </div>
            </form>
          </div>
        )
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-yellow-800 text-sm sm:text-base">
            <Link href="/login" className="underline font-medium hover:text-yellow-900">
              Войдите
            </Link>
            , чтобы оставить отзыв
          </p>
        </div>
      )}

      {reviews.length > 0 ? (
        <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`border rounded-xl p-4 transition-colors ${
                review.user_id === userId 
                  ? 'bg-purple-50/50 border-purple-200 shadow-sm' 
                  : 'bg-gray-50/50 border-purple-100 hover:shadow-md'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                    {getUserInitial(review)}
                  </div>
                  <div>
                    <Link
                      href={`/profile/${review.user_id}`}
                      className="font-medium text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      {getUserName(review)}
                      {review.user_id === userId && (
                        <span className="ml-2 text-xs text-purple-600 font-normal bg-purple-100 px-2 py-0.5 rounded-full">
                          вы
                        </span>
                      )}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {renderStars(review.rating, false, 'sm')}
                      <p className="text-xs text-gray-500">
                        {new Date(review.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {review.report_count !== undefined && review.report_count > 0 && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      review.report_count >= banThreshold 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      ⚠️ {review.report_count}/{banThreshold}
                    </span>
                  )}
                  
                  {review.user_id !== userId && (
                    <button
                      onClick={() => setReportingReviewId(reportingReviewId === review.id ? null : review.id)}
                      className="text-gray-400 hover:text-orange-600 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      🚩 Пожаловаться
                    </button>
                  )}
                  
                  {review.user_id === userId && (
                    <button
                      onClick={() => handleEdit(review)}
                      className="text-purple-600 hover:text-purple-700 text-xs font-medium transition-colors"
                    >
                      ✏️ Редактировать
                    </button>
                  )}
                </div>
              </div>
              
              {reportingReviewId === review.id && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-sm font-medium text-orange-900 mb-2">
                    Причина жалобы:
                  </p>
                  <textarea
                    rows={2}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                    placeholder="Опишите причину жалобы..."
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => handleReport(review.id, review.user_id)}
                      disabled={reporting}
                      className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      {reporting ? 'Отправка...' : 'Отправить жалобу'}
                    </button>
                    <button
                      onClick={() => {
                        setReportingReviewId(null)
                        setReportReason('')
                      }}
                      className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
              
              {review.comment && (
                <p className="text-gray-700 mt-2 whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">💬</div>
          <p className="text-gray-600 font-medium">
            Пока нет отзывов. Будьте первым!
          </p>
        </div>
      )}
    </div>
  )
}