'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function CoachesList({ initialCoaches }: { initialCoaches: any[] }) {
  const [coaches, setCoaches] = useState(initialCoaches || [])
  const [loading, setLoading] = useState<string | null>(null)

  const handleApprove = async (coachId: string) => {
    setLoading(coachId)
    
    // Оптимистичное обновление — сразу меняем статус
    setCoaches(coaches.map(c => 
      c.id === coachId ? { ...c, is_verified: true } : c
    ))
    
    const supabase = createClient()
    const { error } = await supabase
      .from('coaches')
      .update({ is_verified: true })
      .eq('id', coachId)

    if (error) {
      console.error('Error approving coach:', error)
      // Откат изменений при ошибке
      setCoaches(initialCoaches || [])
      alert('Ошибка при одобрении наставника')
    }
    
    setLoading(null)
  }

  const handleRevoke = async (coachId: string) => {
    setLoading(coachId)
    
    // Оптимистичное обновление — сразу меняем статус
    setCoaches(coaches.map(c => 
      c.id === coachId ? { ...c, is_verified: false } : c
    ))
    
    const supabase = createClient()
    const { error } = await supabase
      .from('coaches')
      .update({ is_verified: false })
      .eq('id', coachId)

    if (error) {
      console.error('Error revoking coach:', error)
      // Откат изменений при ошибке
      setCoaches(initialCoaches || [])
      alert('Ошибка при отмене проверки')
    }
    
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          Все наставники
        </h2>
      </div>

      {coaches.length > 0 ? (
        <div className="divide-y">
          {coaches.map((coach) => {
            const lessonsCount = coach.lessons?.length || 0
            const isLoading = loading === coach.id

            return (
              <div key={coach.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {coach.display_name}
                      </h3>
                      {coach.is_verified ? (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          ✓ Проверен
                        </span>
                      ) : (
                        <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
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

                  <div className="flex gap-2 ml-4">
                    {!coach.is_verified ? (
                      <button
                        onClick={() => handleApprove(coach.id)}
                        disabled={isLoading}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isLoading ? '⏳ Одобрение...' : '✓ Одобрить'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevoke(coach.id)}
                        disabled={isLoading}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isLoading ? '⏳ Отмена...' : '⏳ Отменить проверку'}
                      </button>
                    )}

                    <Link
                      href={`/mentor/${coach.id}`}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
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
          <div className="text-6xl mb-4"></div>
          <p className="text-lg">Ничего не найдено</p>
        </div>
      )}
    </div>
  )
}