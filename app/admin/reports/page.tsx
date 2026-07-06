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
  reporter_email?: string
  reported_email?: string
}

export default function ReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'comments' | 'reviews'>('all')

  useEffect(() => {
    loadReports()
  }, [filter])

  const loadReports = async () => {
    try {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      // Загружаем email пользователей
      const reportsWithUsers = await Promise.all(
        (data || []).map(async (report) => {
          const { data: reporterData } = await supabase
            .from('coaches')
            .select('email')
            .eq('user_id', report.reporter_id)
            .single()

          const { data: reportedData } = await supabase
            .from('coaches')
            .select('email')
            .eq('user_id', report.reported_user_id)
            .single()

          return {
            ...report,
            reporter_email: reporterData?.email || 'Неизвестно',
            reported_email: reportedData?.email || 'Неизвестно',
          }
        })
      )

      setReports(reportsWithUsers)
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteReport = async (id: string) => {
    if (!confirm('Удалить эту жалобу?')) return

    try {
      const { error } = await supabase
        .from('reports')
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
              Просмотр жалоб на комментарии
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            ← Назад
          </Link>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все ({reports.length})
            </button>
            <button
              onClick={() => setFilter('comments')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'comments' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              На комментарии
            </button>
            <button
              onClick={() => setFilter('reviews')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'reviews' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              На отзывы
            </button>
          </div>
        </div>

        {/* Список жалоб */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : reports.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border divide-y">
            {reports.map((report) => (
              <div key={report.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Жалоба от: {report.reporter_email}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-sm font-medium text-red-600">
                        на: {report.reported_email}
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
                    onClick={() => handleDeleteReport(report.id)}
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
              Жалоб нет
            </h2>
            <p className="text-gray-600">
              Пока никто не жаловался на контент
            </p>
          </div>
        )}
      </div>
    </main>
  )
}