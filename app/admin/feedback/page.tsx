'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Feedback {
  id: string
  user_id: string
  user_name: string
  type: 'bug' | 'feature'
  title: string
  description: string
  status: 'new' | 'in_progress' | 'resolved' | 'rejected'
  created_at: string
  updated_at: string
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved' | 'rejected'>('all')
  const supabase = createClient()

  useEffect(() => {
    loadFeedbacks()
  }, [])

  const loadFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setFeedbacks(data || [])
    } catch (err) {
      console.error('Error loading feedback:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const updateStatus = async (id: string, status: Feedback['status']) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      loadFeedbacks()
    } catch (err) {
      console.error('Error updating feedback:', err)
      alert('Ошибка при обновлении статуса')
    }
  }

  const downloadCSV = () => {
    const headers = ['ID', 'Пользователь', 'Тип', 'Заголовок', 'Описание', 'Статус', 'Дата создания']
    const rows = feedbacks.map(f => [
      f.id,
      f.user_name,
      f.type === 'bug' ? 'Ошибка' : 'Идея',
      f.title,
      f.description,
      getStatusText(f.status),
      new Date(f.created_at).toLocaleString('ru-RU')
    ])

    const csv = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `feedback_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      new: 'Новое',
      in_progress: 'В работе',
      resolved: 'Решено',
      rejected: 'Отклонено'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return map[status] || 'bg-gray-100 text-gray-800'
  }

  const filteredFeedbacks = filter === 'all' 
    ? feedbacks 
    : feedbacks.filter(f => f.status === filter)

  const stats = {
    total: feedbacks.length,
    new: feedbacks.filter(f => f.status === 'new').length,
    in_progress: feedbacks.filter(f => f.status === 'in_progress').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length,
    rejected: feedbacks.filter(f => f.status === 'rejected').length
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Хлебные крошки */}
      <div className="mb-6">
        <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад в админ-панель
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📋 Обратная связь</h1>
        <button
          onClick={downloadCSV}
          disabled={feedbacks.length === 0}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Скачать CSV
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Всего</div>
        </div>
        <div className="bg-blue-50 rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          <div className="text-sm text-blue-600">Новые</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.in_progress}</div>
          <div className="text-sm text-yellow-600">В работе</div>
        </div>
        <div className="bg-green-50 rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          <div className="text-sm text-green-600">Решено</div>
        </div>
        <div className="bg-red-50 rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-red-600">Отклонено</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'new', 'in_progress', 'resolved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? `Все (${stats.total})` : `${getStatusText(status)} (${stats[status as keyof typeof stats]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
          <div className="text-4xl mb-4">📭</div>
          <p>Нет обращений{filter !== 'all' ? ' с выбранным статусом' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заголовок</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пользователь</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredFeedbacks.map((feedback) => (
                  <tr key={feedback.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        feedback.type === 'bug' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {feedback.type === 'bug' ? '🐛' : '💡'}
                        {feedback.type === 'bug' ? 'Ошибка' : 'Идея'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <div className="font-medium text-gray-900">{feedback.title}</div>
                        <div className="text-sm text-gray-600 mt-1 line-clamp-2">{feedback.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {feedback.user_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(feedback.status)}`}>
                        {getStatusText(feedback.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(feedback.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={feedback.status}
                        onChange={(e) => updateStatus(feedback.id, e.target.value as Feedback['status'])}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="new">Новое</option>
                        <option value="in_progress">В работе</option>
                        <option value="resolved">Решено</option>
                        <option value="rejected">Отклонено</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}