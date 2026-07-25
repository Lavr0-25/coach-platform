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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-100">
        
        {/* Шапка модального окна */}
        <div className="p-6 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-2xl">
          <h2 className="text-xl sm:text-2xl font-bold gradient-text flex items-center gap-2">
            {type === 'bug' ? '🐛 Сообщить об ошибке' : '💡 Предложить идею'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Закрыть"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Выбор типа */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Тип обращения
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('feature')}
                className={`px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${
                  type === 'feature'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <span className="text-xl">💡</span>
                <span>Предложить идею</span>
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${
                  type === 'bug'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <span className="text-xl">🐛</span>
                <span>Сообщить об ошибке</span>
              </button>
            </div>
          </div>

          {/* Заголовок */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Заголовок <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder={type === 'bug' ? 'Краткое описание ошибки' : 'Название вашей идеи'}
              className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all bg-white"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Описание <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={6}
              placeholder={
                type === 'bug'
                  ? 'Опишите, что произошло, шаги для воспроизведения и ожидаемый результат...'
                  : 'Опишите вашу идею подробно: что это, зачем нужно и как это поможет платформе...'
              }
              className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all bg-white resize-none"
            />
          </div>

          {/* Сообщения об ошибках и успехе */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Спасибо! Ваше обращение успешно отправлено. Мы скоро его рассмотрим.</span>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading || success}
              className="flex-1 gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Отправка...
                </>
              ) : success ? (
                'Отправлено!'
              ) : (
                'Отправить обращение'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 border border-purple-200 text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}