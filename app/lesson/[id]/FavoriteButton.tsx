'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FavoriteButtonProps {
  lessonId: string
  userId: string | null
}

export default function FavoriteButton({ lessonId, userId }: FavoriteButtonProps) {
  const supabase = createClient()
  const [isFavorite, setIsFavorite] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [showGroupInput, setShowGroupInput] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userId) {
      checkIfFavorite()
    }
  }, [userId, lessonId])

  const checkIfFavorite = async () => {
    const { data } = await supabase
      .from('favorites')
      .select('id, group_name')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .single()

    if (data) {
      setIsFavorite(true)
      setGroupName(data.group_name || '')
    }
  }

  const handleToggleFavorite = async () => {
    if (!userId) {
      alert('Пожалуйста, войдите в систему')
      return
    }

    setLoading(true)

    try {
      if (isFavorite) {
        // Удаляем из избранного
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('lesson_id', lessonId)

        if (error) throw error
        setIsFavorite(false)
        setGroupName('')
      } else {
        // Добавляем в избранное
        if (!groupName) {
          setShowGroupInput(true)
          setLoading(false)
          return
        }

        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: userId,
            lesson_id: lessonId,
            group_name: groupName || null,
          })

        if (error) throw error
        setIsFavorite(true)
        setShowGroupInput(false)
      }
    } catch (error: any) {
      console.error('Ошибка:', error)
      alert('Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (!userId) {
    return (
      <button
        className="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
        disabled
      >
        ⭐ В избранное (войдите)
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {showGroupInput && !isFavorite ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Название группы (например: Хочу изучить)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleToggleFavorite}
            disabled={loading || !groupName.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 text-sm"
          >
            {loading ? '...' : 'Добавить'}
          </button>
          <button
            onClick={() => {
              setShowGroupInput(false)
              setGroupName('')
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 text-sm"
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          onClick={handleToggleFavorite}
          disabled={loading}
          className={`${
            isFavorite
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50`}
        >
          {loading ? '...' : isFavorite ? '⭐ В избранном' : '⭐ В избранное'}
        </button>
      )}

      {isFavorite && groupName && (
        <span className="text-xs text-gray-500">
          Группа: {groupName}
        </span>
      )}
    </div>
  )
}