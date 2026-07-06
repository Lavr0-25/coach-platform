'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Achievement {
  achievement_id: string
  name: string
  description: string
  icon: string
  category: 'learning' | 'social' | 'special'
  earned_at: string
}

interface AchievementsBadgeProps {
  userId: string
  showAll?: boolean
}

export default function AchievementsBadge({ userId, showAll = false }: AchievementsBadgeProps) {
  const supabase = createClient()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadAchievements()
  }, [userId])

  const loadAchievements = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_achievements', { user_uuid: userId })

      if (error) {
        console.error('Error loading achievements:', error)
        return
      }

      setAchievements(data || [])
    } catch (error) {
      console.error('Error loading achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'learning': return '📚 Обучение'
      case 'social': return '💬 Социальные'
      case 'special': return '⭐ Особые'
      default: return category
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'learning': return 'from-blue-500 to-indigo-600'
      case 'social': return 'from-green-500 to-emerald-600'
      case 'special': return 'from-purple-500 to-pink-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-12 h-12 bg-gray-200 rounded-full"></div>
        ))}
      </div>
    )
  }

  if (achievements.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-2">🏆</div>
        <p className="text-gray-500 text-sm">Пока нет достижений</p>
        <p className="text-gray-400 text-xs mt-1">Пройдите уроки, чтобы получить первые награды!</p>
      </div>
    )
  }

  const displayAchievements = showAll ? achievements : achievements.slice(0, 6)

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">🏆 Достижения</h3>
          {achievements.length > 6 && !showAll && (
            <button
              onClick={() => setShowModal(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Все ({achievements.length}) →
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {displayAchievements.map((achievement) => (
            <div
              key={achievement.achievement_id}
              className="group relative cursor-pointer"
              title={`${achievement.name}: ${achievement.description}`}
            >
              <div className={`w-full aspect-square rounded-full bg-gradient-to-br ${getCategoryColor(achievement.category)} flex items-center justify-center text-3xl shadow-md hover:shadow-lg transition-shadow hover:scale-110`}>
                {achievement.icon}
              </div>
              <p className="text-xs text-center mt-1 font-medium text-gray-700 truncate">
                {achievement.name}
              </p>
            </div>
          ))}
        </div>

        {achievements.length > 6 && !showAll && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Показать все {achievements.length} достижений →
          </button>
        )}
      </div>

      {/* Модальное окно со всеми достижениями */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">🏆 Все достижения</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Группировка по категориям */}
              {(['learning', 'social', 'special'] as const).map((category) => {
                const categoryAchievements = achievements.filter(a => a.category === category)
                if (categoryAchievements.length === 0) return null

                return (
                  <div key={category} className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      {getCategoryLabel(category)}
                      <span className="text-sm text-gray-500 font-normal">
                        ({categoryAchievements.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {categoryAchievements.map((achievement) => (
                        <div
                          key={achievement.achievement_id}
                          className="border rounded-lg p-3 hover:shadow-md transition-shadow"
                        >
                          <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${getCategoryColor(achievement.category)} flex items-center justify-center text-3xl shadow-md mb-2`}>
                            {achievement.icon}
                          </div>
                          <h4 className="font-semibold text-gray-900 text-center text-sm">
                            {achievement.name}
                          </h4>
                          <p className="text-xs text-gray-600 text-center mt-1">
                            {achievement.description}
                          </p>
                          <p className="text-xs text-gray-400 text-center mt-2">
                            Получено: {formatDate(achievement.earned_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t bg-gray-50 text-center">
              <p className="text-sm text-gray-600">
                Всего получено: <strong>{achievements.length}</strong> достижений
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}