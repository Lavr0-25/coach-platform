'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface StopListEntry {
  id: string
  user_id: string
  reason: string
  banned_until: string
  created_at: string
  display_name?: string
}

export default function StopListPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<StopListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newBan, setNewBan] = useState({ user_id: '', reason: '', banned_until: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [filterActive, setFilterActive] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    loadStopList()
  }, [filterActive, filterDate, currentPage])

  const loadStopList = async () => {
    try {
      let query = supabase
        .from('stop_list')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterActive) {
        query = query.gte('banned_until', new Date().toISOString())
      }
      
      if (filterDate) {
        query = query.lte('banned_until', filterDate)
      }

      const { data, error } = await query

      if (error) throw error

      // 🔥 ОПТИМИЗАЦИЯ: Собираем все user_id и делаем ОДИН запрос
      const userIds = (data || []).map((entry: any) => entry.user_id)
      
      let usersMap = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('coaches')
          .select('user_id, display_name')
          .in('user_id', userIds)
        
        usersData?.forEach((u: any) => {
          usersMap.set(u.user_id, u.display_name || 'Неизвестно')
        })
      }

      const entriesWithUsers = (data || []).map((entry: any) => ({
        ...entry,
        display_name: usersMap.get(entry.user_id) || 'Неизвестно',
      }))

      // Пагинация
      const startIndex = (currentPage - 1) * itemsPerPage
      const paginatedEntries = entriesWithUsers.slice(startIndex, startIndex + itemsPerPage)
      
      setEntries(paginatedEntries)
    } catch (error) {
      console.error('Error loading stop list:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchUser = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('user_id, display_name')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(5)
      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error('Error searching user:', error)
    }
  }

  const handleAddBan = async () => {
    if (!newBan.user_id || !newBan.reason || !newBan.banned_until) {
      alert('Заполните все поля')
      return
    }
    try {
      const { error } = await supabase
        .from('stop_list')
        .upsert({ 
          user_id: newBan.user_id, 
          reason: newBan.reason, 
          banned_until: newBan.banned_until 
        }, { onConflict: 'user_id' })
      if (error) throw error
      alert('✅ Пользователь добавлен в стоп-лист')
      setShowAddModal(false)
      setNewBan({ user_id: '', reason: '', banned_until: '' })
      setSearchQuery('')
      setCurrentPage(1)
      await loadStopList()
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось добавить'))
    }
  }

  const handleRemoveBan = async (id: string) => {
    if (!confirm('Разблокировать пользователя?')) return
    try {
      const { error } = await supabase.from('stop_list').delete().eq('id', id)
      if (error) throw error
      setCurrentPage(1)
      await loadStopList()
    } catch (error) {
      console.error('Error removing ban:', error)
    }
  }

  const getRemainingTime = (bannedUntil: string) => {
    const diff = new Date(bannedUntil).getTime() - Date.now()
    if (diff <= 0) return 'Истекла'
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return `${days} дн. ${hours} ч.`
    return `${hours} ч.`
  }

  const isExpired = (bannedUntil: string) => new Date(bannedUntil) < new Date()
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const formatShortDate = (dateString: string) => new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const filteredEntries = filterActive ? entries.filter(e => !isExpired(e.banned_until)) : entries
  const totalPages = Math.ceil((entries.length || 0) / itemsPerPage)

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">🚫 Стоп-лист</h1>
            <p className="text-gray-600 text-sm mt-1">Управление заблокированными пользователями</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/admin" className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm">
              ← Назад
            </Link>
            <button onClick={() => setShowAddModal(true)} className="gradient-btn text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-purple-500/30 text-sm">
              + Добавить блокировку
            </button>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={filterActive} 
                onChange={(e) => { 
                  setFilterActive(e.target.checked)
                  setCurrentPage(1)
                }} 
                className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Только активные блокировки</span>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                placeholder="Выберите дату"
              />
              <button
                onClick={() => {
                  setFilterDate('')
                  setCurrentPage(1)
                }}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Сбросить
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 text-xs text-gray-500">
            <span>Всего: {entries.length} | Показано: {filteredEntries.length}</span>
            <span>Страница {currentPage} из {totalPages}</span>
          </div>
        </div>

        {/* Список */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 animate-pulse space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-purple-100 rounded-xl"></div>)}
          </div>
        ) : filteredEntries.length > 0 ? (
          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const expired = isExpired(entry.banned_until)
              return (
                <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(entry.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{entry.display_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{entry.user_id}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${expired ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                        {expired ? 'Истекла' : 'Активна'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1 ml-13">
                      <p><strong className="text-gray-700">Причина:</strong> {entry.reason}</p>
                      <p className="text-xs text-gray-500">Заблокирован: {formatDate(entry.created_at)}</p>
                      <p className="text-xs text-gray-500">До: {formatShortDate(entry.banned_until)} {!expired && <span className="text-orange-600 font-medium ml-2">⏱️ Осталось: {getRemainingTime(entry.banned_until)}</span>}</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveBan(entry.id)} className="w-full sm:w-auto px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors text-sm">
                    Разблокировать
                  </button>
                </div>
              )
            })}
            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm"
                >
                  ← Предыдущая
                </button>
                <div className="text-gray-600 text-sm">Страница {currentPage} из {totalPages}</div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm"
                >
                  Следующая →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Стоп-лист пуст</h2>
            <p className="text-gray-600 text-sm">{filterActive ? 'Нет активных блокировок' : 'В стоп-листе нет записей'}</p>
          </div>
        )}

        {/* Модальное окно */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-purple-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Добавить в стоп-лист</h2>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя</label>
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => { 
                      setSearchQuery(e.target.value)
                      searchUser()
                    }} 
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" 
                    placeholder="Введите имя..." 
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-purple-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button 
                          key={user.user_id} 
                          onClick={() => { 
                            setNewBan({ ...newBan, user_id: user.user_id })
                            setSearchResults([])
                            setSearchQuery(user.display_name)
                          }} 
                          className="w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors text-sm"
                        >
                          {user.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Причина</label>
                  <textarea 
                    rows={3} 
                    value={newBan.reason} 
                    onChange={(e) => setNewBan({ ...newBan, reason: e.target.value })} 
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" 
                    placeholder="Опишите причину..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Заблокировать до</label>
                  <input 
                    type="datetime-local" 
                    value={newBan.banned_until} 
                    onChange={(e) => setNewBan({ ...newBan, banned_until: e.target.value })} 
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" 
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={handleAddBan} 
                    className="flex-1 gradient-btn text-white py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30"
                  >
                    Заблокировать
                  </button>
                  <button 
                    onClick={() => { 
                      setShowAddModal(false)
                      setNewBan({ user_id: '', reason: '', banned_until: '' })
                      setSearchQuery('')
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