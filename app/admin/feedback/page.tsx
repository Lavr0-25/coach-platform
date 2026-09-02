'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

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
  images?: string[] | null  // 🔥 Добавляем поле для изображений
  admin_reply?: string | null   // ответ админа пользователю («Решено, спасибо…», «Недостаточно данных: …»)
  replied_at?: string | null    // когда ответили
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewingFeedback, setViewingFeedback] = useState<Feedback | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  // Выбранные для массовых действий (id обращений)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Ответ пользователю в модалке просмотра (возврат на доработку = статус «Новое» + комментарий)
  const [modalStatus, setModalStatus] = useState<Feedback['status']>('new')
  const [modalReply, setModalReply] = useState('')
  const [savingModal, setSavingModal] = useState(false)
  const supabase = createClient()
  const itemsPerPage = 10

  useEffect(() => {
    loadFeedbacks()
  }, [])

  // При открытии модалки подставляем текущие статус и ответ обращения
  useEffect(() => {
    if (viewingFeedback) {
      setModalStatus(viewingFeedback.status)
      setModalReply(viewingFeedback.admin_reply || '')
    }
  }, [viewingFeedback])

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

  const updateStatus = async (id: string, status: Feedback['status'], reply?: string) => {
    setUpdatingId(id)
    try {
      // Ответ сохраняем вместе со статусом; replied_at ставим только когда есть текст
      const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
      if (reply !== undefined) {
        payload.admin_reply = reply || null
        payload.replied_at = reply ? new Date().toISOString() : null
      }
      const { error } = await supabase
        .from('feedback')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      await loadFeedbacks()
    } catch (err) {
      console.error('Error updating feedback:', err)
      alert('Ошибка при обновлении статуса')
    } finally {
      setUpdatingId(null)
    }
  }

  // ─── Массовые действия с выбранными обращениями ───
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // «Выбрать все» работает по отфильтрованному списку (все страницы),
  // а не только по видимой десятке — фильтр «Новое» + выбрать все = весь пул новых
  const toggleSelectAll = () => {
    const allFilteredIds = filteredFeedbacks.map(f => f.id)
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : allFilteredIds)
  }

  const clearSelection = () => setSelectedIds([])

  // Один запрос на весь набор: .in('id', [...]) — «где id входит в список»
  const bulkUpdateStatus = async (status: Feedback['status']) => {
    if (selectedIds.length === 0) return
    setBulkUpdating(true)
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', selectedIds)

      if (error) throw error
      clearSelection()
      await loadFeedbacks()
    } catch (err) {
      console.error('Error bulk updating feedback:', err)
      alert('Ошибка при массовом обновлении статуса')
    } finally {
      setBulkUpdating(false)
    }
  }

  // JSON-выгрузка для передачи в работу с агентом: полный текст обращений
  // + ссылки на скриншоты (картинки подтягиваются из Storage по публичным ссылкам).
  // Экспортируется то, что сейчас на экране (с учётом фильтра и поиска):
  // фильтр «Новое» → в файле только новые обращения.
  const downloadJSON = () => {
    const data = {
      exported_at: new Date().toISOString(),
      source: 'rightway.su — обратная связь',
      total: filteredFeedbacks.length,
      items: filteredFeedbacks,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `feedback_${new Date().toISOString().split('T')[0]}.json`
    link.click()
  }

  const downloadCSV = () => {
    const headers = ['ID', 'Пользователь', 'Тип', 'Заголовок', 'Описание', 'Статус', 'Дата создания']
    const rows = filteredFeedbacks.map(f => [
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

  const getStatusStyle = (status: string) => {
    const map: Record<string, string> = {
      new: 'bg-blue-50 text-blue-700 border-blue-200',
      in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      resolved: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200'
    }
    return map[status] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const filteredFeedbacks = feedbacks
    .filter(f => filter === 'all' || f.status === filter)
    .filter(f => 
      searchQuery === '' || 
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.user_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const totalPages = Math.max(1, Math.ceil(filteredFeedbacks.length / itemsPerPage))
  const paginatedFeedbacks = filteredFeedbacks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const stats = {
    total: feedbacks.length,
    new: feedbacks.filter(f => f.status === 'new').length,
    in_progress: feedbacks.filter(f => f.status === 'in_progress').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length,
    rejected: feedbacks.filter(f => f.status === 'rejected').length
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const hasImages = (feedback: Feedback) => {
    return feedback.images && feedback.images.length > 0
  }

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">📋 Обратная связь</h1>
            <p className="text-gray-600 text-sm mt-1">Баги и предложения пользователей</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/admin" className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm">
              ← Назад
            </Link>
            <button
              onClick={downloadJSON}
              disabled={feedbacks.length === 0}
              className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Выгрузить JSON{filter !== 'all' || searchQuery !== '' ? ' (по фильтру)' : ''}
            </button>
            <button
              onClick={downloadCSV}
              disabled={feedbacks.length === 0}
              className="gradient-btn text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Скачать CSV
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
          <StatCard title="Всего" value={stats.total} color="gray" />
          <StatCard title="Новые" value={stats.new} color="blue" />
          <StatCard title="В работе" value={stats.in_progress} color="yellow" />
          <StatCard title="Решено" value={stats.resolved} color="green" />
          <StatCard title="Отклонено" value={stats.rejected} color="red" />
        </div>

        {/* Фильтры и поиск */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Фильтры */}
            <div className="flex flex-wrap gap-2 flex-1">
              {(['all', 'new', 'in_progress', 'resolved', 'rejected'] as const).map((status) => {
                const count = status === 'all' ? stats.total : stats[status as keyof typeof stats]
                return (
                  <button
                    key={status}
                    onClick={() => { setFilter(status); setCurrentPage(1); clearSelection() }}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors text-sm ${
                      filter === status
                        ? 'gradient-btn text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-purple-50'
                    }`}
                  >
                    {status === 'all' ? 'Все' : getStatusText(status)} ({count})
                  </button>
                )
              })}
            </div>

            {/* Поиск */}
            <div className="relative lg:w-80">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); clearSelection() }}
                className="w-full pl-10 pr-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
                placeholder="Поиск по тексту..."
              />
            </div>
          </div>
        </div>

        {/* Панель массовых действий — видна, когда есть выбранные */}
        {selectedIds.length > 0 && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/30 p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-white font-semibold text-sm">
              Выбрано: {selectedIds.length}
              {bulkUpdating && <span className="ml-2 font-normal opacity-80">Сохраняем...</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => bulkUpdateStatus('in_progress')}
                disabled={bulkUpdating}
                className="px-4 py-2 bg-white text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 text-sm"
              >
                → В работе
              </button>
              <button
                onClick={() => bulkUpdateStatus('resolved')}
                disabled={bulkUpdating}
                className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl font-medium hover:bg-green-100 transition-colors disabled:opacity-50 text-sm"
              >
                → Решено
              </button>
              <button
                onClick={() => bulkUpdateStatus('rejected')}
                disabled={bulkUpdating}
                className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors disabled:opacity-50 text-sm"
              >
                → Отклонено
              </button>
              <button
                onClick={clearSelection}
                disabled={bulkUpdating}
                className="px-4 py-2 border border-white/40 text-white rounded-xl font-medium hover:bg-white/10 transition-colors disabled:opacity-50 text-sm"
              >
                Снять выделение
              </button>
            </div>
          </div>
        )}

        {/* Список обращений */}
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 animate-pulse space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-purple-100 rounded-xl"></div>)}
          </div>
        ) : paginatedFeedbacks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-12 text-center">
            <div className="text-5xl mb-3"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              {searchQuery ? 'Ничего не найдено' : 'Нет обращений'}
            </h2>
            <p className="text-gray-600 text-sm">
              {searchQuery 
                ? 'Попробуйте изменить поисковый запрос' 
                : filter !== 'all' 
                  ? 'Нет обращений с выбранным статусом' 
                  : 'Пользователи ещё не отправляли обращения'}
            </p>
          </div>
        ) : (
          <>
            {/* Десктопная таблица */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-purple-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                        {/* «Выбрать все» — по всему отфильтрованному списку */}
                        <input
                          type="checkbox"
                          checked={paginatedFeedbacks.length > 0 && paginatedFeedbacks.every(f => selectedIds.includes(f.id))}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                          title="Выбрать все (по текущему фильтру)"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Тип</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Заголовок</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Пользователь</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Дата</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {paginatedFeedbacks.map((feedback) => (
                      <tr key={feedback.id} className={`transition-colors ${selectedIds.includes(feedback.id) ? 'bg-purple-50' : 'hover:bg-purple-50/30'}`}>
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(feedback.id)}
                            onChange={() => toggleSelect(feedback.id)}
                            className="w-4 h-4 accent-purple-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            feedback.type === 'bug' 
                              ? 'bg-red-50 text-red-700 border border-red-200' 
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {feedback.type === 'bug' ? '🐛' : '💡'}
                            {feedback.type === 'bug' ? 'Ошибка' : 'Идея'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-md">
                            <button 
                              onClick={() => setViewingFeedback(feedback)}
                              className="font-semibold text-gray-900 hover:text-purple-600 transition-colors text-left"
                            >
                              {feedback.title}
                            </button>
                            <div className="text-sm text-gray-600 mt-1 line-clamp-2">{feedback.description}</div>
                            {hasImages(feedback) && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-purple-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>📎 {feedback.images!.length} файл(ов)</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {(feedback.user_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[120px]">{feedback.user_name || 'Аноним'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(feedback.status)}`}>
                            {getStatusText(feedback.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(feedback.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={feedback.status}
                            onChange={(e) => updateStatus(feedback.id, e.target.value as Feedback['status'])}
                            disabled={updatingId === feedback.id}
                            className="px-3 py-1.5 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white disabled:opacity-50"
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

            {/* Мобильные карточки */}
            <div className="lg:hidden space-y-3">
              {paginatedFeedbacks.map((feedback) => (
                <div key={feedback.id} className={`bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-colors ${selectedIds.includes(feedback.id) ? 'border-purple-300 bg-purple-50/50' : 'border-purple-100'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(feedback.id)}
                        onChange={() => toggleSelect(feedback.id)}
                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                      />
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        feedback.type === 'bug' 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {feedback.type === 'bug' ? '🐛' : '💡'}
                        {feedback.type === 'bug' ? 'Ошибка' : 'Идея'}
                      </span>
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(feedback.status)}`}>
                        {getStatusText(feedback.status)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(feedback.created_at)}</span>
                  </div>

                  <button 
                    onClick={() => setViewingFeedback(feedback)}
                    className="font-semibold text-gray-900 hover:text-purple-600 transition-colors text-left block mb-2"
                  >
                    {feedback.title}
                  </button>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{feedback.description}</p>
                  
                  {hasImages(feedback) && (
                    <div className="flex items-center gap-1 mb-3 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 w-fit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>📎 {feedback.images!.length} файл(ов)</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-purple-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {(feedback.user_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[120px]">{feedback.user_name || 'Аноним'}</span>
                    </div>
                    <select
                      value={feedback.status}
                      onChange={(e) => updateStatus(feedback.id, e.target.value as Feedback['status'])}
                      disabled={updatingId === feedback.id}
                      className="px-3 py-1.5 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white disabled:opacity-50"
                    >
                      <option value="new">Новое</option>
                      <option value="in_progress">В работе</option>
                      <option value="resolved">Решено</option>
                      <option value="rejected">Отклонено</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Предыдущая
                </button>
                <div className="text-gray-600 text-sm">Страница {currentPage} из {totalPages}</div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Следующая →
                </button>
              </div>
            )}
          </>
        )}

        {/* Модальное окно просмотра */}
        {viewingFeedback && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingFeedback(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-purple-100" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-purple-100 bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        viewingFeedback.type === 'bug' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {viewingFeedback.type === 'bug' ? '🐛' : '💡'}
                        {viewingFeedback.type === 'bug' ? 'Ошибка' : 'Идея'}
                      </span>
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(viewingFeedback.status)}`}>
                        {getStatusText(viewingFeedback.status)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{viewingFeedback.title}</h2>
                  </div>
                  <button 
                    onClick={() => setViewingFeedback(null)}
                    className="p-2 hover:bg-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Описание</p>
                  <div className="bg-gray-50 rounded-xl p-4 text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {viewingFeedback.description}
                  </div>
                </div>

                {/* 🔥 Отображение изображений */}
                {hasImages(viewingFeedback) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Прикреплённые файлы ({viewingFeedback.images!.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {viewingFeedback.images!.map((imgUrl, index) => (
                        <div key={index} className="relative group">
                          <div
                            className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-200 cursor-pointer hover:border-purple-400 transition-colors hover:shadow-lg"
                            onClick={() => setSelectedImage(imgUrl)}
                          >
                            <Image
                              src={imgUrl}
                              alt={`Attachment ${index + 1}`}
                              fill
                              sizes="(max-width: 640px) 50vw, 33vw"
                              className="w-full h-full object-cover transition-transform duration-200"
                            />
                          </div>
                          <a 
                            href={imgUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                            title="Открыть в новом окне"
                          >
                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Пользователь</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {(viewingFeedback.user_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{viewingFeedback.user_name || 'Аноним'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Дата создания</p>
                    <p className="text-sm text-gray-700">{formatDate(viewingFeedback.created_at)}</p>
                  </div>
                </div>

                {viewingFeedback.updated_at && viewingFeedback.updated_at !== viewingFeedback.created_at && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Последнее обновление</p>
                    <p className="text-sm text-gray-700">{formatDate(viewingFeedback.updated_at)}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-purple-100 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Ответ пользователю
                    </label>
                    <textarea
                      value={modalReply}
                      onChange={(e) => setModalReply(e.target.value)}
                      rows={3}
                      placeholder="Например: «Решено 02.09, спасибо, что помогаете сделать платформу лучше» или «Недостаточно данных: уточните, пожалуйста, …» (тогда верните статус «Новое» — пользователь сможет дополнить обращение)"
                      className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Статус</label>
                    <select
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value as Feedback['status'])}
                      className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white"
                    >
                      <option value="new">Новое</option>
                      <option value="in_progress">В работе</option>
                      <option value="resolved">Решено</option>
                      <option value="rejected">Отклонено</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={savingModal || updatingId === viewingFeedback.id}
                    onClick={async () => {
                      setSavingModal(true)
                      await updateStatus(viewingFeedback.id, modalStatus, modalReply.trim())
                      // Показываем сохранённое в модалке и в списке
                      setViewingFeedback({
                        ...viewingFeedback,
                        status: modalStatus,
                        admin_reply: modalReply.trim() || null,
                        replied_at: modalReply.trim() ? new Date().toISOString() : null,
                      })
                      setSavingModal(false)
                    }}
                    className="gradient-btn text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {savingModal || updatingId === viewingFeedback.id ? 'Сохраняю…' : 'Сохранить статус и ответ'}
                  </button>
                  <p className="text-xs text-gray-400">
                    Ответ увидит пользователь в «Мои обращения». Пустой ответ стирает предыдущий.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🔥 Модальное окно для просмотра изображения */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Image
              src={selectedImage}
              alt="Full size"
              width={1920}
              height={1080}
              className="w-auto h-auto max-w-full max-h-[90vh] rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </main>
  )
}

// Вспомогательный компонент для карточек статистики
function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const styles: Record<string, string> = {
    // Белый стиль П5: цвет — только в цифре (text-...), карточка нейтральная
    gray: 'bg-white border-gray-100 text-gray-700',
    blue: 'bg-white border-gray-100 text-blue-600',
    yellow: 'bg-white border-gray-100 text-yellow-600',
    green: 'bg-white border-gray-100 text-green-600',
    red: 'bg-white border-gray-100 text-red-600',
  }
  
  return (
    <div className={`rounded-2xl border p-4 ${styles[color]}`}>
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
      <div className="text-xs md:text-sm opacity-80 mt-1">{title}</div>
    </div>
  )
}