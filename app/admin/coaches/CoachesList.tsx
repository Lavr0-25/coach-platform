'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setCoachVerified } from '@/app/admin/actions'
import { useToast } from '@/components/Toast'

// Статус-чипы — семантический цвет в рамке, как во всей админке
const chip = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border'

export default function CoachesList({ initialCoaches }: { initialCoaches: any[] }) {
  const [coaches, setCoaches] = useState(initialCoaches || [])
  const [loading, setLoading] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleApprove = async (coachId: string) => {
    setLoading(coachId)

    // Оптимистичное обновление — сразу меняем статус
    setCoaches(coaches.map(c =>
      c.id === coachId ? { ...c, is_verified: true } : c
    ))

    const result = await setCoachVerified(coachId, true)

    if (!result.ok) {
      console.error('Error approving coach:', result.error)
      // Откат изменений при ошибке
      setCoaches(initialCoaches || [])
      showToast(result.error || 'Ошибка при одобрении наставника', 'error')
    } else {
      showToast('Наставник проверен', 'success')
    }

    setLoading(null)
  }

  const handleRevoke = async (coachId: string) => {
    setLoading(coachId)

    // Оптимистичное обновление — сразу меняем статус
    setCoaches(coaches.map(c =>
      c.id === coachId ? { ...c, is_verified: false } : c
    ))

    const result = await setCoachVerified(coachId, false)

    if (!result.ok) {
      console.error('Error revoking coach:', result.error)
      // Откат изменений при ошибке
      setCoaches(initialCoaches || [])
      showToast(result.error || 'Ошибка при отмене проверки', 'error')
    } else {
      showToast('Проверка отменена', 'success')
    }

    setLoading(null)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
      <div className="p-5 md:p-6 border-b border-purple-100 bg-gray-50">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">
          🎓 Все наставники
        </h2>
      </div>

      {coaches.length > 0 ? (
        <div className="divide-y divide-purple-50">
          {coaches.map((coach) => {
            const lessonsCount = coach.lessons?.length || 0
            const isLoading = loading === coach.id

            return (
              <div key={coach.id} className="p-4 md:p-6 hover:bg-purple-50/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                        {(coach.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {coach.display_name}
                      </h3>
                      {coach.is_verified ? (
                        <span className={`${chip} bg-green-50 text-green-700 border-green-200`}>
                          ✓ Проверен
                        </span>
                      ) : (
                        <span className={`${chip} bg-orange-50 text-orange-700 border-orange-200`}>
                          ⏳ Ожидает проверки
                        </span>
                      )}
                    </div>

                    {coach.specialization && (
                      <p className="text-gray-600 text-sm mb-2">
                        🎯 {coach.specialization}
                      </p>
                    )}

                    {coach.bio && (
                      <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                        {coach.bio}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>📚 {lessonsCount} уроков</span>
                      <span>📅 {new Date(coach.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:ml-4">
                    {!coach.is_verified ? (
                      <button
                        onClick={() => handleApprove(coach.id)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? '⏳ Одобрение...' : '✓ Одобрить'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevoke(coach.id)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? '⏳ Отмена...' : '⏳ Отменить проверку'}
                      </button>
                    )}

                    <Link
                      href={`/mentor/${coach.id}`}
                      className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-50 transition-colors"
                    >
                      👁️ Просмотр
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-gray-500">
          <div className="text-5xl mb-3">🎓</div>
          <p className="text-lg font-semibold text-gray-900">Ничего не найдено</p>
          <p className="text-sm mt-1">Попробуйте изменить поиск или фильтр</p>
        </div>
      )}
    </div>
  )
}