'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteReport, upsertStopList } from '@/app/admin/actions'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { Input, Textarea } from '@/components/ui/Input'

interface Report {
  id: string
  reporter_id: string
  reported_user_id: string
  reason: string
  created_at: string
  reporter_name?: string
  reported_name?: string
}

export default function ReportsPage() {
  const toast = useToast()
  const supabase = createClient()
  const [commentReports, setCommentReports] = useState<Report[]>([])
  const [reviewReports, setReviewReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'comments' | 'reviews'>('comments')
  const [showBanModal, setShowBanModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('')

  useEffect(() => { loadReports() }, [])

  const loadReports = async () => {
    try {
      const { data: commentData } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
      const { data: reviewData } = await supabase.from('review_reports').select('*').order('created_at', { ascending: false })

      const userIds = new Set<string>()
      ;(commentData || []).forEach(r => { userIds.add(r.reporter_id); userIds.add(r.reported_user_id) })
      ;(reviewData || []).forEach(r => { userIds.add(r.reporter_id); userIds.add(r.reported_user_id) })

      let namesMap = new Map<string, string>()
      if (userIds.size > 0) {
        const { data: usersData } = await supabase.from('coaches').select('user_id, display_name').in('user_id', Array.from(userIds))
        usersData?.forEach((u: any) => namesMap.set(u.user_id, u.display_name || u.user_id.substring(0, 8)))
      }

      setCommentReports((commentData || []).map(r => ({ ...r, reporter_name: namesMap.get(r.reporter_id), reported_name: namesMap.get(r.reported_user_id) })))
      setReviewReports((reviewData || []).map(r => ({ ...r, reporter_name: namesMap.get(r.reporter_id), reported_name: namesMap.get(r.reported_user_id) })))
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteReport = async (id: string, type: 'comment' | 'review') => {
    if (!confirm('Удалить эту жалобу?')) return
    const result = await deleteReport(id, type)
    if (!result.ok) {
      console.error('Error deleting report:', result.error)
      toast.showToast(result.error || 'Ошибка при удалении жалобы', 'error')
    } else {
      await loadReports()
    }
  }

  const handleBanUser = (userId: string, userName: string) => {
    setSelectedUserId(userId)
    setBanReason(`Нарушение правил платформы (жалобы от пользователей)`)
    setShowBanModal(true)
  }

  const submitBan = async () => {
    if (!selectedUserId || !banReason || !banDuration) {
      toast.showToast('Заполните все поля', 'info')
      return
    }

    const days = parseInt(banDuration)
    const date = new Date()
    date.setDate(date.getDate() + days)
    const bannedUntil = date.toISOString()

    const result = await upsertStopList(selectedUserId, banReason, bannedUntil)

    if (!result.ok) {
      toast.showToast(result.error || 'Ошибка: не удалось заблокировать', 'error')
    } else {
      toast.showToast('Пользователь заблокирован', 'success')
      setShowBanModal(false)
      setSelectedUserId('')
      setBanReason('')
      setBanDuration('')
    }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">⚠️ Жалобы</h1>
            <p className="text-gray-600 text-sm mt-1">Просмотр и модерация жалоб на контент</p>
          </div>
          <Link href="/admin" className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm">← Назад</Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-2 mb-6 flex gap-1">
          <button onClick={() => setTab('comments')} className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors text-sm ${tab === 'comments' ? 'gradient-btn text-white shadow-md' : 'text-gray-600 hover:bg-purple-50'}`}>
            На комментарии ({commentReports.length})
          </button>
          <button onClick={() => setTab('reviews')} className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors text-sm ${tab === 'reviews' ? 'gradient-btn text-white shadow-md' : 'text-gray-600 hover:bg-purple-50'}`}>
            На отзывы ({reviewReports.length})
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 animate-pulse space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-purple-100 rounded-xl"></div>)}
          </div>
        ) : (
          <div className="space-y-4">
            {(tab === 'comments' ? commentReports : reviewReports).length > 0 ? (
              (tab === 'comments' ? commentReports : reviewReports).map((report) => (
                <div key={report.id} className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 md:p-5 hover:shadow-md transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap text-sm">
                        <span className="font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">От: {report.reporter_name}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">На: {report.reported_name}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <strong className="text-purple-700">Причина:</strong> {report.reason}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(report.created_at)}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => handleBanUser(report.reported_user_id, report.reported_name || '')} 
                        className="w-full sm:w-auto px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                         Забанить
                      </button>
                      <button 
                        onClick={() => handleDeleteReport(report.id, tab === 'comments' ? 'comment' : 'review')} 
                        className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        Удалить жалобу
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-12 text-center">
                <div className="text-5xl mb-3">✅</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Жалоб нет</h2>
                <p className="text-gray-600 text-sm">В этой категории пока нет жалоб</p>
              </div>
            )}
          </div>
        )}

        {/* Модальное окно бана */}
        {showBanModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-purple-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Заблокировать пользователя</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Причина блокировки</label>
                  <Textarea size="compact" 
                    rows={3} 
                    value={banReason} 
                    onChange={(e) => setBanReason(e.target.value)} 
                    placeholder="Опишите причину..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Срок блокировки (дней)</label>
                  <Input size="compact" 
                    type="number" 
                    value={banDuration} 
                    onChange={(e) => setBanDuration(e.target.value)} 
                    min="1" 
                    placeholder="Например: 7" 
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={submitBan} 
                    className="flex-1 gradient-btn text-white py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30"
                  >
                    Заблокировать
                  </button>
                  <button 
                    onClick={() => { 
                      setShowBanModal(false)
                      setSelectedUserId('')
                      setBanReason('')
                      setBanDuration('')
                    }} 
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}