'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function FeedbackPage() {
  const [type, setType] = useState<'bug' | 'feature'>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (!user) {
        router.push('/login')
      }
    }
    getUser()
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')

    try {
      const file = files[0]
      
      // Проверка размера (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Файл слишком большой. Максимальный размер 5MB')
        setUploading(false)
        return
      }

      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, загрузите изображение')
        setUploading(false)
        return
      }

      // Создаем уникальный путь
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `feedback/${fileName}`

      // Загружаем в Storage
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Получаем публичную ссылку
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath)

      setImages(prev => [...prev, publicUrl])
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Ошибка при загрузке изображения')
    } finally {
      setUploading(false)
      // Очищаем input
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
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
          images: images.length > 0 ? images : null,
          status: 'new'
        })

      if (error) throw error

      setSuccess(true)
      setTitle('')
      setDescription('')
      setImages([])
      
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch (err: any) {
      console.error('Error submitting feedback:', err)
      setError(err.message || 'Ошибка при отправке')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:text-purple-600 transition-colors">Главная</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Обратная связь</span>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
          Обратная связь
        </h1>
        <p className="text-gray-600">
          Помогите нам стать лучше — расскажите о проблеме или предложите новую идею
        </p>
      </div>

      <div className="style-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Выбор типа */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Тип обращения
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('feature')}
                className={`px-4 py-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 font-medium ${
                  type === 'feature'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <span className="text-2xl">💡</span>
                <span>Предложить идею</span>
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`px-4 py-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 font-medium ${
                  type === 'bug'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <span className="text-2xl">🐛</span>
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

          {/* Загрузка изображений */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Скриншоты и изображения {images.length > 0 && <span className="text-gray-400 font-normal">({images.length})</span>}
            </label>
            
            {/* Превью загруженных изображений */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                {images.map((img, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-100 group">
                    <img
                      src={img}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Кнопка загрузки */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-50/30 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-2"></div>
                    <p className="text-sm text-gray-500">Загрузка...</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold text-purple-600">Нажмите для загрузки</span> или перетащите файл
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF (макс. 5MB)</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {/* Сообщения */}
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
              <div>
                <p className="font-semibold">Спасибо! Ваше обращение успешно отправлено.</p>
                <p className="text-sm mt-1">Мы скоро его рассмотрим и свяжемся с вами.</p>
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading || success || uploading}
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
            <Link
              href="/"
              className="px-6 py-3 border border-purple-200 text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors text-center"
            >
              Отмена
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}