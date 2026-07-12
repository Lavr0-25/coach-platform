'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'feature'>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Пожалуйста, войдите в систему')
        setIsLoading(false)
        return
      }

      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          user_name: user.email || 'Аноним',
          type,
          title,
          description,
          status: 'new'
        })

      if (error) throw error

      // Успешно отправлено
      setTitle('')
      setDescription('')
      setSuccess(true)
      
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)
      
      router.refresh()
    } catch (err: any) {
      console.error('Error submitting feedback:', err)
      setError(err.message || 'Ошибка при отправке')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {type === 'bug' ? '🐛 Сообщить об ошибке' : '💡 Предложить идею'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Выбор типа */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип обращения
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setType('feature')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  type === 'feature'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className="text-xl">💡</span>
                <span>Предложить идею</span>
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  type === 'bug'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className="text-xl">🐛</span>
                <span>Сообщить об ошибке</span>
              </button>
            </div>
          </div>

          {/* Заголовок */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Заголовок *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder={type === 'bug' ? 'Краткое описание ошибки' : 'Название вашей идеи'}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={6}
              placeholder={
                type === 'bug'
                  ? 'Опишите что произошло, шаги для воспроизведения, ожидаемый результат...'
                  : 'Опишите вашу идею подробно: что это, зачем нужно, как поможет платформе...'
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✅ Спасибо! Ваше обращение отправлено.
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isLoading || success}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Отправка...' : success ? 'Отправлено!' : 'Отправить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}