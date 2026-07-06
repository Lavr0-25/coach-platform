'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  status: 'started' | 'completed'
  progress_percentage: number
  started_at: string
  completed_at: string | null
  last_watched_at: string
}

interface LessonProgressProps {
  lessonId: string
}

export default function LessonProgress({ lessonId }: LessonProgressProps) {
  const supabase = createClient()
  const [progress, setProgress] = useState<LessonProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadProgress()
    }
  }, [userId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)
  }

  const loadProgress = async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading progress:', error)
      }

      setProgress(data)
    } catch (error) {
      console.error('Error loading progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    if (!userId) return

    setUpdating(true)

    try {
      // Отслеживаем начало урока
      await supabase
        .from('analytics_events')
        .insert({
          event_type: 'lesson_start',
          user_id: userId,
          target_id: lessonId,
          target_type: 'lesson',
        })

      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: userId,
          lesson_id: lessonId,
          status: 'started',
          progress_percentage: 10,
        }, {
          onConflict: 'user_id,lesson_id'
        })

      if (error) throw error

      await loadProgress()
    } catch (error: any) {
      console.error('Error starting lesson:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось начать урок'))
    } finally {
      setUpdating(false)
    }
  }

  const handleComplete = async () => {
    if (!userId) return

    setUpdating(true)

    try {
      // Отслеживаем завершение урока
      await supabase
        .from('analytics_events')
        .insert({
          event_type: 'lesson_complete',
          user_id: userId,
          target_id: lessonId,
          target_type: 'lesson',
        })

      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: userId,
          lesson_id: lessonId,
          status: 'completed',
          progress_percentage: 100,
        }, {
          onConflict: 'user_id,lesson_id'
        })

      if (error) throw error

      await loadProgress()
      alert('🎉 Поздравляем! Урок отмечен как пройденный!')
    } catch (error: any) {
      console.error('Error completing lesson:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось отметить урок'))
    } finally {
      setUpdating(false)
    }
  }

  const handleReset = async () => {
    if (!userId) return
    if (!confirm('Сбросить прогресс по этому уроку?')) return

    setUpdating(true)

    try {
      const { error } = await supabase
        .from('lesson_progress')
        .delete()
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)

      if (error) throw error

      setProgress(null)
    } catch (error: any) {
      console.error('Error resetting progress:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось сбросить прогресс'))
    } finally {
      setUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!userId) {
    return null
  }

  if (!progress) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">📚 Прогресс урока</h3>
            <p className="text-sm text-gray-600">
              Урок ещё не начат. Нажмите кнопку, чтобы отметить начало.
            </p>
          </div>
          <button
            onClick={handleStart}
            disabled={updating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {updating ? 'Загрузка...' : '▶️ Начать урок'}
          </button>
        </div>
      </div>
    )
  }

  if (progress.status === 'started') {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">📚 Прогресс урока</h3>
            <p className="text-sm text-gray-600">
              Урок в процессе. Отметьте как пройденный, когда закончите.
            </p>
          </div>
          <span className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full font-medium">
            В процессе
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Прогресс</span>
            <span>{progress.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all"
              style={{ width: `${progress.progress_percentage}%` }}
            ></div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          Начат: {formatDate(progress.started_at)}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleComplete}
            disabled={updating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            {updating ? 'Сохранение...' : '✅ Отметить как пройденный'}
          </button>
          <button
            onClick={handleReset}
            disabled={updating}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:bg-gray-400"
          >
            Сбросить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">🎉 Урок пройден!</h3>
          <p className="text-sm text-gray-600">
            Поздравляем! Вы успешно завершили этот урок.
          </p>
        </div>
        <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium">
          ✅ Завершён
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Прогресс</span>
          <span>100%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-3 space-y-1">
        <p>Начат: {formatDate(progress.started_at)}</p>
        {progress.completed_at && (
          <p>Завершён: {formatDate(progress.completed_at)}</p>
        )}
      </div>

      <button
        onClick={handleReset}
        disabled={updating}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:bg-gray-400"
      >
        🔄 Пройти ещё раз
      </button>
    </div>
  )
}