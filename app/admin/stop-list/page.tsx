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
  user_email?: string
  display_name?: string
}

export default function StopListPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<StopListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newBan, setNewBan] = useState({
    user_id: '',
    reason: '',
    banned_until: '',
  })
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [filterActive, setFilterActive] = useState(true)

  useEffect(() => {
    loadStopList()
  }, [filterActive])

  const loadStopList = async () => {
    try {
      let query = supabase
        .from('stop_list')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterActive) {
        query = query.gte('banned_until', new Date().toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Загружаем информацию о пользователях через coaches
      const entriesWithUsers = await Promise.all(
        (data || []).map(async (entry) => {
          const { data: coachData } = await supabase
            .from('coaches')
            .select('display_name, email')
            .eq('user_id', entry.user_id)
            .single()

          return {
            ...entry,
            user_email: coachData?.email || 'Неизвестно',
            display_name: coachData?.display_name || null,
          }
        })
      )

      setEntries(entriesWithUsers)
    } catch (error) {
      console.error('Error loading stop list:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchUser = async () => {
    if (!searchEmail.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('user_id, display_name, email')
        .ilike('email', `%${searchEmail}%`)
        .limit(5)

      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error('Error searching user:', error)
    }
  }

  const selectUser = (user: any) => {
    setNewBan({
      ...newBan,
      user_id: user.user_id,
    })
    setSearchResults([])
    setSearchEmail('')
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
          banned_until: newBan.banned_until,
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      alert('✅ Пользователь добавлен в стоп-лист')
      setShowAddModal(false)
      setNewBan({ user_id: '', reason: '', banned_until: '' })
      await loadStopList()
    } catch (error: any) {
      console.error('Error adding ban:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось добавить в стоп-лист'))
    }
  }

  const handleRemoveBan = async (id: string) => {
    if (!confirm('Удалить пользователя из стоп-листа?')) return

    try {
      const { error } = await supabase
        .from('stop_list')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadStopList()
    } catch (error) {
      console.error('Error removing ban:', error)
    }
  }

  const isExpired = (bannedUntil: string) => {
    return new Date(bannedUntil) < new Date()
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
            <h1 className="text-3xl font-bold text-gray-900">🚫 Стоп-лист</h1>
            <p className="text-gray-600 mt-1">
              Управление заблокированными пользователями
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              ← Назад
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              + Добавить блокировку
            </button>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterActive}
              onChange={(e) => setFilterActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Только активные блокировки
            </span>
          </label>
        </div>

        {/* Список */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : entries.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border divide-y">
            {entries.map((entry) => {
              const expired = isExpired(entry.banned_until)
              
              return (
                <div key={entry.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {(entry.user_email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.display_name || entry.user_email || 'Неизвестно'}
                        </p>
                        <p className="text-sm text-gray-500">{entry.user_email}</p>
                      </div>
                      {expired ? (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          Истекла
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                          Активна
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Причина:</strong> {entry.reason}</p>
                      <p><strong>Заблокирован:</strong> {formatDate(entry.created_at)}</p>
                      <p><strong>До:</strong> {formatDate(entry.banned_until)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBan(entry.id)}
                    className="ml-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
                  >
                    Разблокировать
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Стоп-лист пуст
            </h2>
            <p className="text-gray-600">
              {filterActive ? 'Нет активных блокировок' : 'В стоп-листе нет записей'}
            </p>
          </div>
        )}

        {/* Модальное окно */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Добавить в стоп-лист
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email пользователя
                </label>
                <input
                  type="text"
                  value={searchEmail}
                  onChange={(e) => {
                    setSearchEmail(e.target.value)
                    searchUser()
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Введите email..."
                />

                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded-md divide-y">
                    {searchResults.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => selectUser(user)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">
                          {user.display_name || user.email}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина блокировки
                </label>
                <textarea
                  rows={3}
                  value={newBan.reason}
                  onChange={(e) => setNewBan({ ...newBan, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Опишите причину..."
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Заблокировать до
                </label>
                <input
                  type="datetime-local"
                  value={newBan.banned_until}
                  onChange={(e) => setNewBan({ ...newBan, banned_until: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddBan}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Заблокировать
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewBan({ user_id: '', reason: '', banned_until: '' })
                    setSearchResults([])
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}