'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Типы контента
const CONTENT_TYPES = [
  { value: 'youtube', label: '🎥 YouTube видео', hint: 'Вставьте ссылку на YouTube видео' },
  { value: 'vk_video', label: '🎥 VK Видео', hint: 'Вставьте ссылку на видео ВКонтакте' },
  { value: 'yandex_disk', label: '📁 Яндекс.Диск', hint: 'Ссылка на папку Яндекс.Диска' },
  { value: 'pdf', label: '📄 PDF файл', hint: 'Ссылка на PDF файл' },
  { value: 'image', label: '️ Картинка', hint: 'Ссылка на изображение' },
  { value: 'presentation', label: '📊 Презентация', hint: 'Ссылка на презентацию' },
]

export default function NewLessonPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [coachId, setCoachId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Данные урока
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isFreePreview, setIsFreePreview] = useState(false)
  
  // Данные контента
  const [contentType, setContentType] = useState('youtube')
  const [contentUrl, setContentUrl] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [contentTitle, setContentTitle] = useState('')

  useEffect(() => {
    // Получаем coach_id текущего пользователя
    const getCoachId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (coach) {
        setCoachId(coach.id)
      } else {
        setError('Ваш профиль наставника не найден. Обратитесь к администратору.')
      }
    }

    getCoachId()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!coachId) {
      setError('Ошибка: профиль наставника не найден')
      return
    }

    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    if (!contentUrl.trim()) {
      setError('Введите ссылку на контент')
      return
    }

    setLoading(true)

    try {
      // 1. Создаём урок
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          course_id: null, // Пока без курса
          module_id: null,
          title: title.trim(),
          description: description.trim() || null,
          price: parseFloat(price) || 0,
          is_free_preview: isFreePreview,
          order_index: 1,
        })
        .select()
        .single()

      if (lessonError) throw lessonError

      // 2. Создаём контент урока
      const { error: contentError } = await supabase
        .from('lesson_content')
        .insert({
          lesson_id: lesson.id,
          content_type: contentType,
          content_url: contentUrl.trim(),
          access_password: accessPassword.trim() || null,
          title: contentTitle.trim() || null,
          order_index: 1,
        })

      if (contentError) throw contentError

      alert('Урок успешно создан!')
      router.push('/dashboard/mentor')
    } catch (error: any) {
      setError(error.message || 'Ошибка при создании урока')
    } finally {
      setLoading(false)
    }
  }

  // Находим выбранный тип контента для отображения подсказки
  const selectedContentType = CONTENT_TYPES.find(t => t.value === contentType)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600">
              CoachPlatform
            </Link>
            <span className="text-gray-400">|</span>
            <Link href="/dashboard/mentor" className="text-gray-700 hover:text-blue-600 transition-colors">
              Кабинет наставника
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">Новый урок</span>
          </div>
          
          <Link href="/dashboard/mentor" className="text-gray-600 hover:text-blue-600 transition-colors">
            ← Назад в кабинет
          </Link>
        </div>
      </header>

      {/* Форма */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Создание нового урока
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Основная информация */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Основная информация
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Название урока *
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Например: Введение в психологию"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Краткое описание урока..."
                />
              </div>
            </div>
          </div>

          {/* Контент урока */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Контент урока
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 mb-1">
                  Тип контента *
                </label>
                <select
                  id="contentType"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {CONTENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedContentType?.hint}
                </p>
              </div>

              <div>
                <label htmlFor="contentUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Ссылка на контент *
                </label>
                <input
                  id="contentUrl"
                  type="url"
                  required
                  value={contentUrl}
                  onChange={(e) => setContentUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={contentType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                />
              </div>

              {/* Пароль для Яндекс.Диска */}
              {contentType === 'yandex_disk' && (
                <div>
                  <label htmlFor="accessPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Пароль доступа к папке
                  </label>
                  <input
                    id="accessPassword"
                    type="text"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Пароль от папки Яндекс.Диска (если есть)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Если папка защищена паролем, укажите его здесь
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="contentTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Заголовок контента (необязательно)
                </label>
                <input
                  id="contentTitle"
                  type="text"
                  value={contentTitle}
                  onChange={(e) => setContentTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Например: Видеоурок №1"
                />
              </div>
            </div>
          </div>

          {/* Цена и доступ */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Цена и доступ
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                  Цена урока (руб.)
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Оставьте 0, если урок бесплатный
                </p>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="isFreePreview"
                    type="checkbox"
                    checked={isFreePreview}
                    onChange={(e) => setIsFreePreview(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="isFreePreview" className="font-medium text-gray-700">
                    Бесплатный превью
                  </label>
                  <p className="text-gray-500">
                    Этот урок будет доступен для просмотра без покупки
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Создание...' : 'Создать урок'}
            </button>
            
            <Link
              href="/dashboard/mentor"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Отмена
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}