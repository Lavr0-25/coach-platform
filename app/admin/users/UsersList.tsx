'use client'

import { useState } from 'react'
import Link from 'next/link'
import { banUser, unbanUser } from '@/app/admin/actions'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'

export default function UsersList({ initialUsers }: { initialUsers: any[] }) {
  const toast = useToast()
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

    const days = banDuration ? parseInt(banDuration) : undefined
    const result = await banUser(selectedUser.id, banReason, days)

    if (!result.ok) {
      console.error('Error banning user:', result.error)
      toast.showToast(result.error || 'Ошибка при блокировке пользователя', 'error')
    } else {
      toast.showToast(`Пользователь ${selectedUser.email} заблокирован`, 'info')
      window.location.reload()
    }

    setLoading(null)
  }

  const handleUnban = async (userId: string, email: string) => {
    if (!confirm(`Разблокировать пользователя ${email}?`)) return

    setLoading(userId)

    const result = await unbanUser(userId)

    if (!result.ok) {
      console.error('Error unbanning user:', result.error)
      toast.showToast(result.error || 'Ошибка при разблокировке', 'error')
    } else {
      toast.showToast(`Пользователь ${email} разблокирован`, 'info')
      window.location.reload()
    }

    setLoading(null)
  }

  const getDisplayName = (user: any) => {
    return user.coaches?.[0]?.display_name || user.full_name || 'Без имени'
  }

  const getInitials = (user: any) => {
    const name = getDisplayName(user)
    if (name === 'Без имени') return (user.email || 'U').charAt(0).toUpperCase()
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-purple-100 bg-gray-50">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
            👥 Все пользователи
          </h2>
        </div>

        {users.length > 0 ? (
          <div className="divide-y divide-purple-50">
            {users.map((user) => {
              const coachInfo = user.coaches?.[0]
              const activeBan = user.user_bans?.find((b: any) => b.is_active)
              const isBanned = !!activeBan
              const displayName = getDisplayName(user)
              
              return (
                <div key={user.id} className="p-4 md:p-6 hover:bg-purple-50/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    
                    {/* Левая часть: Информация о пользователе */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        {(user.coaches?.[0]?.avatar_url || user.avatar_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.coaches?.[0]?.avatar_url || user.avatar_url}
                            alt={displayName}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                            {getInitials(user)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                            {displayName}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">📧 {user.email}</p>
                        </div>
                      </div>

                      {/* Бейджи */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant={user.role === 'admin' ? 'redFill' : user.role === 'mentor' ? 'greenFill' : 'purpleFill'}>
                          {user.role === 'admin' ? 'Админ' : user.role === 'mentor' ? 'Автор' : 'Студент'}
                        </Badge>

                        {isBanned && (
                          <Badge variant="red">🚫 Заблокирован</Badge>
                        )}
                      </div>

                      {isBanned && (
                        <p className="text-sm text-red-600 mb-2 bg-red-50/50 p-2.5 rounded-xl border border-red-100">
                          ⚠️ <strong>Причина:</strong> {activeBan.reason}
                        </p>
                      )}

                      <p className="text-xs text-gray-400">
                        📅 Регистрация: {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>

                    {/*  Статистика: Уроки / Курсы / Подписчики */}
                    <div className="grid grid-cols-3 gap-3 lg:gap-6 lg:min-w-[280px]">
                      <div className="text-center p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                        <div className="text-2xl font-bold text-purple-700">
                          {user.lessons_count || 0}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Уроков</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="text-2xl font-bold text-blue-700">
                          {user.courses_count || 0}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Курсов</div>
                      </div>
                      <div className="text-center p-3 bg-green-50/50 rounded-xl border border-green-100">
                        <div className="text-2xl font-bold text-green-700">
                          {user.subscribers_count || 0}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Подписчиков</div>
                      </div>
                    </div>

                    {/* Правая часть: Кнопки действий */}
                    <div className="flex flex-col sm:flex-row gap-2 lg:ml-4 w-full sm:w-auto">
                      {/* Профиль доступен для любого пользователя: автор — его
                          богатая страница, остальные — публичный профиль студента */}
                      {!isBanned && (
                        <Link
                          href={coachInfo ? `/mentor/${coachInfo.id}` : `/profile/${user.id}`}
                          className="w-full sm:w-auto text-center px-4 py-2.5 bg-white border border-purple-200 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-50 transition-colors"
                        >
                          👁️ Профиль
                        </Link>
                      )}
                      
                      {user.role !== 'admin' && (
                        isBanned ? (
                          <button
                            onClick={() => handleUnban(user.id, user.email || '')}
                            disabled={loading === user.id}
                            className="w-full sm:w-auto px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading === user.id ? '...' : '✓ Разблокировать'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(user.id, user.email || '')}
                            disabled={loading === user.id}
                            className="w-full sm:w-auto px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="text-5xl mb-3">👥</div>
            <p className="text-lg font-medium">Ничего не найдено</p>
            <p className="text-sm text-gray-400 mt-1">Попробуйте изменить параметры поиска</p>
          </div>
        )}
      </div>

      {/* Модальное окно бана */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-purple-100 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Заблокировать пользователя</h2>
            <p className="text-sm text-gray-500 mb-6">Укажите причину и срок блокировки</p>
            
            <form onSubmit={submitBan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email пользователя</label>
                <input
                  type="text"
                  value={selectedUser?.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Причина блокировки <span className="text-red-500">*</span>
                </label>
                <Textarea size="compact"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Опишите причину блокировки..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Срок блокировки (дни)</label>
                <Input size="compact"
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  min="1"
                  placeholder="Оставьте пустым для бессрочной блокировки"
                />
                <p className="text-xs text-gray-500 mt-1.5">Оставьте пустым для бессрочной блокировки</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!banReason.trim() || loading === selectedUser?.id}
                  className="flex-1 gradient-btn text-white py-2.5 rounded-xl font-medium shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {loading === selectedUser?.id ? '⏳ Блокировка...' : '🚫 Заблокировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}