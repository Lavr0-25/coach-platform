'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface FavoriteButtonProps {
  itemId: string
  itemType: 'course' | 'lesson'
  initialIsFavorited?: boolean
  size?: 'sm' | 'md'
}

export default function FavoriteButton({ itemId, itemType, initialIsFavorited = false, size = 'md' }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
      
      if (user && !initialIsFavorited) {
        const { data } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('lesson_id', itemId)
          .maybeSingle()
        
        setIsFavorited(!!data)
      }
    }
    getUser()
  }, [itemId, itemType, initialIsFavorited])

  const toggleFavorite = async (e: React.MouseEvent) => {
    // ВАЖНО: останавливаем всплытие клика, чтобы не переходить по ссылке
    e.stopPropagation()
    e.preventDefault()

    if (!userId) {
      router.push('/login')
      return
    }

    setLoading(true)
    try {
      if (isFavorited) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('lesson_id', itemId)
        
        if (error) throw error
      } else {
        // Сначала проверяем, нет ли уже записи (чтобы избежать 409)
        const { data: existing } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', userId)
          .eq('lesson_id', itemId)
          .maybeSingle()

        if (existing) {
          // Уже в избранном — просто обновляем состояние
          setIsFavorited(true)
        } else {
          const { error } = await supabase
            .from('favorites')
            .insert({ 
              user_id: userId, 
              lesson_id: itemId,
              group_name: 'default'
            })
          
          if (error) {
            // Если всё равно 409 — значит добавили между запросами
            if (error.code === '23505') {
              setIsFavorited(true)
            } else {
              throw error
            }
          } else {
            setIsFavorited(true)
          }
        }
      }
      router.refresh()
    } catch (error) {
      console.error('Ошибка при изменении избранного:', error)
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`${sizeClasses} rounded-full bg-white/90 backdrop-blur-sm border border-purple-200 shadow-sm flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50`}
      title={isFavorited ? 'Удалить из избранного' : 'Добавить в избранное'}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent" />
      ) : (
        <svg 
          className={`${iconSize} transition-colors ${isFavorited ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} 
          fill={isFavorited ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )}
    </button>
  )
}