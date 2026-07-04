'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles?: {
    full_name?: string
  } | null
}

interface CommentSectionProps {
  lessonId: string
  userId?: string
}

export default function CommentSection({ lessonId, userId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadComments()
  }, [lessonId])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles:user_id (
          full_name
        )
      `)
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })

    // Обрабатываем данные - profiles может прийти как массив
    const commentsWithProfiles = (data || []).map((comment: any) => ({
      ...comment,
      profiles: Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
    }))
    
    setComments(commentsWithProfiles)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !userId) return

    setLoading(true)

    const { error } = await supabase
      .from('comments')
      .insert({
        lesson_id: lessonId,
        user_id: userId,
        content: newComment.trim()
      })

    if (error) {
      console.error('Error adding comment:', error)
      alert('Ошибка при добавлении комментария')
    } else {
      setNewComment('')
      await loadComments()
    }

    setLoading(false)
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Удалить комментарий?')) return

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('Error deleting comment:', error)
      alert('Ошибка при удалении комментария')
    } else {
      await loadComments()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        💬 Комментарии ({comments.length})
      </h2>

      {/* Форма добавления комментария */}
      {userId ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Напишите комментарий..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            required
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? '⏳ Отправка...' : '📝 Добавить комментарий'}
          </button>
        </form>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-gray-600">
            Войдите в систему, чтобы оставить комментарий
          </p>
        </div>
      )}

      {/* Список комментариев */}
      {comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => {
            const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
            const fullName = profile?.full_name || 'Аноним'
            
            return (
              <div
                key={comment.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {fullName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString('ru-RU', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {userId && comment.user_id === userId && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      🗑️ Удалить
                    </button>
                  )}
                </div>

                <p className="text-gray-700 ml-13">
                  {comment.content}
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg">Пока нет комментариев</p>
          <p className="text-sm">Будьте первым, кто оставит комментарий!</p>
        </div>
      )}
    </div>
  )
}