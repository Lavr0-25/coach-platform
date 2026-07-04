'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  user_id: string
  profiles?: {
    full_name?: string
  } | null
}

interface ReviewSectionProps {
  coachId: string
  userId?: string
}

export default function ReviewSection({ coachId, userId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadReviews()
    if (userId) {
      loadUserReview()
    }
  }, [coachId, userId])

  const loadReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id,
        profiles:user_id (
          full_name
        )
      `)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })

    const reviewsWithProfiles = (data || []).map((review: any) => ({
      ...review,
      profiles: Array.isArray(review.profiles) ? review.profiles[0] : review.profiles
    }))
    
    setReviews(reviewsWithProfiles)

    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length
      setAverageRating(Math.round(avg * 10) / 10)
    }
  }

  const loadUserReview = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('coach_id', coachId)
      .eq('user_id', userId)
      .single()

    if (data) {
      setUserReview(data)
      setNewRating(data.rating)
      setNewComment(data.comment || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setLoading(true)

    const reviewData = {
      coach_id: coachId,
      user_id: userId,
      rating: newRating,
      comment: newComment.trim()
    }

    let error
    if (userReview) {
      const result = await supabase
        .from('reviews')
        .update(reviewData)
        .eq('id', userReview.id)
      error = result.error
    } else {
      const result = await supabase
        .from('reviews')
        .insert(reviewData)
      error = result.error
    }

    if (error) {
      console.error('Error saving review:', error)
      alert('Ошибка при сохранении отзыва')
    } else {
      await loadReviews()
      await loadUserReview()
      alert('Отзыв сохранён!')
    }

    setLoading(false)
  }

  const handleDelete = async () => {
    if (!userReview || !confirm('Удалить ваш отзыв?')) return

    setLoading(true)

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', userReview.id)

    if (error) {
      console.error('Error deleting review:', error)
      alert('Ошибка при удалении отзыва')
    } else {
      setUserReview(null)
      setNewRating(5)
      setNewComment('')
      await loadReviews()
    }

    setLoading(false)
  }

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClass = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl'
    return (
      <div className={`flex gap-1 ${sizeClass}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}>
            ★
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        ⭐ Отзывы ({reviews.length})
      </h2>

      {reviews.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold text-yellow-600">
              {averageRating.toFixed(1)}
            </div>
            <div>
              {renderStars(Math.round(averageRating), 'lg')}
              <p className="text-sm text-gray-600 mt-1">
                На основе {reviews.length} отзывов
              </p>
            </div>
          </div>
        </div>
      )}

      {userId ? (
        <form onSubmit={handleSubmit} className="mb-6 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            {userReview ? '✏️ Ваш отзыв' : '📝 Оставить отзыв'}
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Оценка
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewRating(star)}
                  className={`text-3xl transition-colors ${
                    star <= newRating ? 'text-yellow-400' : 'text-gray-300'
                  } hover:text-yellow-400`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Комментарий (необязательно)
            </label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Поделитесь вашим опытом..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
  setNewRating(5)
  setNewComment('')
}}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? '⏳ Сохранение...' : userReview ? '💾 Обновить' : '📝 Оставить отзыв'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-gray-600">
            Войдите в систему, чтобы оставить отзыв
          </p>
        </div>
      )}

      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => {
            const profile = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles
            const fullName = profile?.full_name || 'Аноним'
            
            return (
              <div
                key={review.id}
                className={`border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                  review.user_id === userId ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {fullName}
                        {review.user_id === userId && (
                          <span className="ml-2 text-xs text-blue-600">(ваш отзыв)</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(review.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  {renderStars(review.rating, 'sm')}
                </div>

                {review.comment && (
                  <p className="text-gray-700">
                    {review.comment}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-6xl mb-4">⭐</div>
          <p className="text-lg">Пока нет отзывов</p>
          <p className="text-sm">Будьте первым, кто оставит отзыв!</p>
        </div>
      )}
    </div>
  )
}