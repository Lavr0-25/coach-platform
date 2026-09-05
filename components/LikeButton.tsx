'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface LikeButtonProps {
  lessonId: string
  initialCount: number
  /** Текущий пользователь уже лайкнул этот урок */
  initialLiked?: boolean
  /** Автор урока: счётчик виден, но лайкнуть своё нельзя */
  readOnly?: boolean
}

export default function LikeButton({ lessonId, initialCount, initialLiked = false, readOnly = false }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(initialLiked)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggleLike = async () => {
    if (readOnly || loading) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    setLoading(true)

    // Оптимистично: цифра и подсветка меняются сразу, откат при ошибке
    const nextLiked = !liked
    setLiked(nextLiked)
    setCount(c => c + (nextLiked ? 1 : -1))

    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: user.id, lesson_id: lessonId })

        if (error) {
          // 23505 — уже лайкнул (двойной клик): оставляем состояние «лайкнул»
          if (error.code !== '23505') {
            console.error('Ошибка лайка:', error)
            setLiked(false)
            setCount(c => c - 1)
          }
        }
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)

        if (error) {
          console.error('Ошибка снятия лайка:', error)
          setLiked(true)
          setCount(c => c + 1)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Автор урока (или другой случай «только посмотреть») — не кнопка, а счётчик
  if (readOnly) {
    return (
      <span className="text-sm text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full" title="Лайки урока">
        <svg className={`w-4 h-4 ${count > 0 ? 'text-red-500' : 'text-gray-400'}`} fill={count > 0 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {count}
      </span>
    )
  }

  return (
    <button
      onClick={toggleLike}
      disabled={loading}
      aria-pressed={liked}
      title={liked ? 'Убрать лайк' : 'Нравится урок'}
      className={`text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-[transform,color,background-color,border-color,box-shadow] active:scale-95 disabled:opacity-60 ${
        liked
          ? 'bg-red-50 border-red-200 text-red-600'
          : 'bg-gray-50 border-transparent text-gray-500 hover:text-red-600 hover:bg-red-50'
      }`}
    >
      <svg
        className={`w-4 h-4 transition-colors ${liked ? 'text-red-500 fill-red-500' : ''}`}
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      {count}
    </button>
  )
}