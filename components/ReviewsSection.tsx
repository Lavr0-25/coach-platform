'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Review {
  id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
  coaches?: {
    display_name: string
  }
}

interface ReviewsSectionProps {
  courseId?: string
  lessonId?: string
}

export default function ReviewsSection({ courseId, lessonId }: ReviewsSectionProps) {
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState<number>(0)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId !== null) {
      loadReviews()
    }
  }, [userId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      setUserEmail(user.email || null)
    } else {
      setUserId(null)
      setUserEmail(null)
      setLoading(false)
    }
  }

  const loadReviews = async () => {
    try {
      let query = supabase
        .from('reviews')
        .select(`
          *,
          coaches:user_id (
            display_name
          )
        `)
        .order('created_at', { ascending: false })

      if (courseId) {
        query = query.eq('course_id', courseId)
      } else if (lessonId) {
        query = query.eq('lesson_id', lessonId)
      }

      const { data, error } = await query

      if (error) throw error

      setReviews(data || [])

      if (data && data.length > 0) {
        const avg = data.reduce((sum: number, r: Review) => sum + r.rating, 0) / data.length
        setAverageRating(Math.round(avg * 10) / 10)
      } else {
        setAverageRating(0)
      }

      if (userId) {
        const found = data?.find((r: Review) => r.user_id === userId)
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
      alert('Войдите, чтобы оставить отзыв')
      return
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

      if (userReview) {
        const { error } = await supabase
          .from('reviews')
          .update(reviewData)
          .eq('id', userReview.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reviews')
          .insert(reviewData)

        if (error) throw error
      }

      await loadReviews()
      alert('✅ Отзыв сохранён!')
    } catch (error: any) {
      console.error('Error saving review:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось сохранить отзыв'))
    } finally {
      setSubmitting(false)
    }
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
      alert('Отзыв удалён')
    } catch (error: any) {
      console.error('Error deleting review:', error)
      alert('Ошибка при удалении отзыва')
    }
  }

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    }

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${sizeClasses[size]} ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
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
    return review.coaches?.display_name || userEmail?.split('@')[0] || 'Пользователь'
  }

  const getUserInitial = (review: Review) => {
    const name = getUserName(review)
    return name.charAt(0).toUpperCase()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-900">
          ⭐ Отзывы и рейтинги
        </h2>
        
        {reviews.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-gray-900">
              {averageRating.toFixed(1)}
            </div>
            {renderStars(Math.round(averageRating), 'lg')}
            <span className="text-sm text-gray-500">
              ({reviews.length} {getReviewsWord(reviews.length)})
            </span>
          </div>
        )}
      </div>

      {userId ? (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">
            {userReview ? 'Ваш отзыв' : 'Оставьте отзыв'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ваша оценка
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <svg
                      className={`w-8 h-8 ${
                        star <= newRating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                Комментарий (необязательно)
              </label>
              <textarea
                id="comment"
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Поделитесь впечатлениями..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {submitting ? 'Сохранение...' : userReview ? 'Обновить отзыв' : 'Опубликовать отзыв'}
              </button>
              
              {userReview && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-100 text-red-600 px-6 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors"
                >
                  Удалить отзыв
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            <a href="/login" className="underline font-medium hover:text-yellow-900">
              Войдите
            </a>
            , чтобы оставить отзыв
          </p>
        </div>
      )}

      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => {
            const userName = getUserName(review)
            
            return (
              <div
                key={review.id}
                className={`border rounded-lg p-4 ${
                  review.user_id === userId ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {getUserInitial(review)}
                    </div>
                    <div>
                      <Link
                        href={`/mentor/${review.user_id}`}
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {userName}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {new Date(review.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  {renderStars(review.rating, 'sm')}
                </div>
                
                {review.comment && (
                  <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                    {review.comment}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-gray-600">
            Пока нет отзывов. Будьте первым!
          </p>
        </div>
      )}
    </div>
  )
}