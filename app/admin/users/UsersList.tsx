'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function UsersList({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers] = useState(initialUsers || [])
  const [loading, setLoading] = useState<string | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('')

  const handleBan = async (userId: string, email: string) => {
    setSelectedUser({ id: userId, email })
    setShowBanModal(true)
    setBanReason('')
    setBanDuration('')
  }

  const submitBan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !banReason) return

    setLoading(selectedUser.id)
    setShowBanModal(false)

    const supabase = createClient()
    
    // Рассчитываем дату разблокировки
    let unbannedAt = null
    if (banDuration) {
      const days = parseInt(banDuration)
      const date = new Date()
      date.setDate(date.getDate() + days)
      unbannedAt = date.toISOString()
    }

    const { error } = await supabase
      .from('user_bans')
      .insert({
        user_id: selectedUser.id,
        banned_by: (users.find(u => u.role === 'admin') as any)?.id,
        reason: banReason,
        unbanned_at: unbannedAt,
        is_active: true
      })

    if (error) {
      console.error('Error banning user:', error)
      alert('Ошибка при блокировке пользователя')
    } else {
      alert(`Пользователь ${selectedUser.email} заблокирован`)
      // Обновляем список
      window.location.reload()
    }
    
    setLoading(null)
  }

  const handleUnban = async (userId: string, email: string) => {
    if (!confirm(`Разблокировать пользователя ${email}?`)) return

    setLoading(userId)
    
    const supabase = createClient()
    const { error } = await supabase
      .from('user_bans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) {
      console.error('Error unbanning user:', error)
      alert('Ошибка при разблокировке')
    } else {
      alert(`Пользователь ${email} разблокирован`)
      window.location.reload()
    }
    
    setLoading(null)
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Все пользователи
          </h2>
        </div>

        {users.length > 0 ? (
          <div className="divide-y">
            {users.map((user) => {
              const coachInfo = user.coaches?.[0]
              const activeBan = user.user_bans?.find((b: any) => b.is_active)
              const isBanned = !!activeBan
              
              return (
                <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user.full_name || 'Без имени'}
                        </h3>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'mentor'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {user.role === 'admin' ? 'Админ' : user.role === 'mentor' ? 'Наставник' : 'Студент'}
                        </span>
                        {isBanned && (
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            🚫 Заблокирован
                          </span>
                        )}
                        {coachInfo && !isBanned && (
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${
                            coachInfo.is_verified
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {coachInfo.is_verified ? '✓ Проверен' : '⏳ Ожидает'}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm mb-2">
                        📧 {user.email}
                      </p>

                      {isBanned && (
                        <p className="text-red-600 text-sm mb-2">
                          ⚠️ Причина: {activeBan.reason}
                        </p>
                      )}

                      <p className="text-gray-500 text-sm">
                        📅 Регистрация: {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {coachInfo && !isBanned && (
                        <Link
                          href={`/mentor/${coachInfo.id}`}
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          👁️ Профиль
                        </Link>
                      )}
                      
                      {user.role !== 'admin' && (
                        isBanned ? (
                          <button
                            onClick={() => handleUnban(user.id, user.email || '')}
                            disabled={loading === user.id}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
                          >
                            {loading === user.id ? '⏳...' : '✓ Разблокировать'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(user.id, user.email || '')}
                            disabled={loading === user.id}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400"
                          >
                            {loading === user.id ? '⏳...' : '🚫 Заблокировать'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-lg">Ничего не найдено</p>
          </div>
        )}
      </div>

      {/* Модальное окно бана */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Заблокировать пользователя
            </h2>
            
            <form onSubmit={submitBan}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email пользователя
                </label>
                <input
                  type="text"
                  value={selectedUser?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина блокировки *
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Опишите причину блокировки..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Срок блокировки (дни)
                </label>
                <input
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Оставьте пустым для бессрочной блокировки"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Оставьте пустым для бессрочной блокировки
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!banReason.trim()}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400"
                >
                  Заблокировать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}