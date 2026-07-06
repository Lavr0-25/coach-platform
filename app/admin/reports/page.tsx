'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Report {
  id: string
  reporter_id: string
  reported_user_id: string
  comment_id?: string
  review_id?: string
  lesson_id?: string
  reason: string
  created_at: string
  reporter_name?: string
  reported_name?: string
}

export default function ReportsPage() {
  const supabase = createClient()
  const [commentReports, setCommentReports] = useState<Report[]>([])
  const [reviewReports, setReviewReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'comments' | 'reviews'>('comments')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      console.log('🔄 Загрузка жалоб...')
      
      // Загружаем жалобы на комментарии
      const { data: commentData, error: commentError } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (commentError) {
        console.error('❌ Ошибка загрузки жалоб на комментарии:', commentError)
        throw commentError
      }

      console.log('📥 Жалоб на комментарии:', commentData?.length || 0)

      // Загружаем жалобы на отзывы
      const { data: reviewData, error: reviewError } = await supabase
        .from('review_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (reviewError) {
        console.error('❌ Ошибка загрузки жалоб на отзывы:', reviewError)
        throw reviewError
      }

      console.log(' Жалоб на отзывы:', reviewData?.length || 0)

      // Собираем все user_id
      const userIds = new Set<string>()
      ;(commentData || []).forEach(r => {
        userIds.add(r.reporter_id)
        userIds.add(r.reported_user_id)
      })
      ;(reviewData || []).forEach(r => {
        userIds.add(r.reporter_id)
        userIds.add(r.reported_user_id)
      })

      console.log('🔍 Загружаем имена для', userIds.size, 'пользователей')

      // Загружаем имена
      const namesMap: Record<string, string> = {}
      for (const uid of userIds) {
        const { data: coach } = await supabase
          .from('coaches')
          .select('display_name')
          .eq('user_id', uid)
          .single()
        
        namesMap[uid] = coach?.display_name || uid.substring(0, 8)
        console.log(`  ${uid.substring(0, 8)}... → ${namesMap[uid]}`)
      }

      const commentsWithNames = (commentData || []).map(r => ({
        ...r,
        reporter_name: namesMap[r.reporter_id] || 'Неизвестно',
        reported_name: namesMap[r.reported_user_id] || 'Неизвестно',
      }))

      const reviewsWithNames = (reviewData || []).map(r => ({
        ...r,
        reporter_name: namesMap[r.reporter_id] || 'Неизвестно',
        reported_name: namesMap[r.reported_user_id] || 'Неизвестно',
      }))

      setCommentReports(commentsWithNames)
      setReviewReports(reviewsWithNames)
      
      console.log('✅ Загрузка завершена')
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteReport = async (id: string, type: 'comment' | 'review') => {
    if (!confirm('Удалить эту жалобу?')) return

    try {
      const table = type === 'comment' ? 'reports' : 'review_reports'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadReports()
    } catch (error) {
      console.error('Error deleting report:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⚠️ Жалобы</h1>
            <p className="text-gray-600 mt-1">
              Просмотр всех жалоб на контент
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            ← Назад
          </Link>
        </div>

        {/* Табы */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setTab('comments')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === 'comments' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              На комментарии ({commentReports.length})
            </button>
            <button
              onClick={() => setTab('reviews')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === 'reviews' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              На отзывы ({reviewReports.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {tab === 'comments' ? (
              commentReports.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border divide-y">
                  {commentReports.map((report) => (
                    <div key={report.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">
                              От: {report.reporter_name}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-sm font-medium text-red-600">
                              На: {report.reported_name}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            <strong>Причина:</strong> {report.reason}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(report.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteReport(report.id, 'comment')}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Жалоб на комментарии нет
                  </h2>
                </div>
              )
            ) : (
              reviewReports.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border divide-y">
                  {reviewReports.map((report) => (
                    <div key={report.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">
                              От: {report.reporter_name}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-sm font-medium text-red-600">
                              На: {report.reported_name}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            <strong>Причина:</strong> {report.reason}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(report.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteReport(report.id, 'review')}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Жалоб на отзывы нет
                  </h2>
                </div>
              )
            )}
          </>
        )}
      </div>
    </main>
  )
}