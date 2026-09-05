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
      className={`${sizeClasses} rounded-full bg-white/90 backdrop-blur-sm border border-purple-200 shadow-sm flex items-center justify-center transition-[transform,color,background-color,border-color,box-shadow] active:scale-95 disabled:opacity-50`}
      title={isFavorited ? 'Удалить из избранного' : 'Добавить в избранное'}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent" />
      ) : (
        <svg
          className={`${iconSize} transition-colors ${isFavorited ? 'text-amber-400 fill-amber-400' : 'text-gray-400'}`}
          fill={isFavorited ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )}
    </button>
  )
}