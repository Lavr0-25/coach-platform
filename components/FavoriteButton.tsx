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
      
      if (user) {
        let query = supabase.from('favorites').select('id').eq('user_id', user.id)
        
        if (itemType === 'course') {
          query = query.eq('course_id', itemId)
        } else {
          query = query.eq('lesson_id', itemId)
        }
        
        const { data } = await query.maybeSingle()
        setIsFavorited(!!data)
      }
    }
    getUser()
  }, [itemId, itemType])

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!userId) {
      router.push('/login')
      return
    }

    setLoading(true)
    
    try {
      if (isFavorited) {
        // Удаляем из избранного
        let query = supabase.from('favorites').delete().eq('user_id', userId)
        
        if (itemType === 'course') {
          query = query.eq('course_id', itemId)
        } else {
          query = query.eq('lesson_id', itemId)
        }
        
        const { error } = await query
        
        if (error) {
          console.error('Ошибка удаления:', error)
        } else {
          setIsFavorited(false)
        }
      } else {
        // Добавляем в избранное
        const insertData: any = { user_id: userId }
        
        if (itemType === 'course') {
          insertData.course_id = itemId
        } else {
          insertData.lesson_id = itemId
        }
        
        const { error } = await supabase.from('favorites').insert(insertData)
        
        if (error) {
          console.error('Ошибка вставки:', error)
          if (error.code === '23505') {
            setIsFavorited(true)
          }
        } else {
          setIsFavorited(true)
        }
      }
    } catch (error) {
      console.error('Общая ошибка:', error)
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