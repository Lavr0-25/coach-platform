'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RemoveFavoriteButtonProps {
  itemId: string
  itemType: 'course' | 'lesson'
  onRemove: () => void
}

export default function RemoveFavoriteButton({ itemId, itemType, onRemove }: RemoveFavoriteButtonProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleRemove = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase.from('favorites').delete().eq('user_id', user.id)
      
      if (itemType === 'course') {
        query = query.eq('course_id', itemId)
      } else {
        query = query.eq('lesson_id', itemId)
      }
      
      const { error } = await query
      
      if (error) throw error
      
      // Вызываем callback для немедленного удаления из UI
      onRemove()
    } catch (error) {
      console.error('Ошибка удаления:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-red-200 shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 active:scale-95 transition-[transform,color,background-color,border-color,box-shadow] disabled:opacity-50 z-10"
      title="Удалить из избранного"
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  )
}