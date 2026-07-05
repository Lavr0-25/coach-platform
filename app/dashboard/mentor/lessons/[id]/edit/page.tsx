'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LessonContent {
  id?: string
  content_type: string
  content_url: string
  order_index?: number
}

export default function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  if (!resolvedParams) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return <EditLessonForm lessonId={resolvedParams.id} />
}

function EditLessonForm({ lessonId }: { lessonId: string }) {
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Данные урока
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isFreePreview, setIsFreePreview] = useState(false)

  // Контент
  const [contentType, setContentType] = useState('youtube')
  const [contentUrl, setContentUrl] = useState('')

  useEffect(() => {
    loadLesson()
  }, [])

  const loadLesson = async () => {
    try {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single()

      if (lessonError) throw lessonError

      if (lesson) {
        setTitle(lesson.title || '')
        setDescription(lesson.description || '')
        setPrice(lesson.price?.toString() || '0')
        setIsFreePreview(lesson.is_free_preview || false)

        // Загружаем контент
        const { data: content } = await supabase
          .from('lesson_content')
          .select('*')
          .eq('lesson_id', lessonId)
          .order('order_index', { ascending: true })
          .limit(1)

        if (content && content.length > 0) {
          setContentType(content[0].content_type || 'youtube')
          setContentUrl(content[0].content_url || '')
        }
      }
    } catch (error: any) {
      console.error('Error loading lesson:', error)
      setError('Ошибка загрузки урока')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    if (!contentUrl.trim()) {
      setError('Добавьте ссылку на контент')
      return
    }

    setSaving(true)

    try {
      // Обновляем урок
      const { error: lessonError } = await supabase
        .from('lessons')
        .update({
          title: title.trim(),
          description: description.trim(),
          price: parseFloat(price) || 0,
          is_free_preview: isFreePreview,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lessonId)

      if (lessonError) throw lessonError

      // Обновляем или создаём контент
      const { data: existingContent } = await supabase
        .from('lesson_content')
        .select('id')
        .eq('lesson_id', lessonId)
        .single()

      let contentError

      if (existingContent) {
        // Обновляем существующий контент
        const { error } = await supabase
          .from('lesson_content')
          .update({
            content_type: contentType,
            content_url: contentUrl.trim(),
          })
          .eq('id', existingContent.id)
        
        contentError = error
      } else {
        // Создаём новый контент
        const { error } = await supabase
          .from('lesson_content')
          .insert({
            lesson_id: lessonId,
            content_type: contentType,
            content_url: contentUrl.trim(),
            order_index: 0,
          })
        
        contentError = error
      }

      if (contentError) throw contentError

      setSuccess('Урок успешно обновлён!')
      
      // Перенаправляем через 2 секунды
      setTimeout(() => {
        router.push('/dashboard/mentor/lessons')
      }, 2000)
    } catch (error: any) {
      console.error('Error updating lesson:', error)
      setError(error.message || 'Ошибка при сохранении урока')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка урока...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor" className="hover:text-blue-600">
          Кабинет наставника
        </Link>
        <span>/</span>
        <Link href="/dashboard/mentor/lessons" className="hover:text-blue-600">
          Мои уроки
        </Link>
        <span>/</span>
        <span className="text-gray-900">Редактировать урок</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Редактировать урок
      </h1>

      {/* Уведомления */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите название урока"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Опишите, что будет в уроке..."
              />
            </div>
          </div>
        </div>

        {/* Контент урока */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🎬 Контент урока
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип контента
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setContentType('youtube')}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    contentType === 'youtube'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">🎥</div>
                  <div className="text-sm font-medium">YouTube</div>
                </button>
                <button
                  type="button"
                  onClick={() => setContentType('vk_video')}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    contentType === 'vk_video'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">📹</div>
                  <div className="text-sm font-medium">VK Видео</div>
                </button>
                <button
                  type="button"
                  onClick={() => setContentType('yandex_disk')}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    contentType === 'yandex_disk'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">💾</div>
                  <div className="text-sm font-medium">Яндекс.Диск</div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="contentUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Ссылка на видео *
              </label>
              <input
                id="contentUrl"
                type="url"
                required
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  contentType === 'youtube'
                    ? 'https://www.youtube.com/watch?v=...'
                    : contentType === 'vk_video'
                    ? 'https://vk.com/video-xxx_xxx'
                    : 'https://disk.yandex.ru/...'
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {contentType === 'youtube' && 'Вставьте ссылку на видео с YouTube'}
                {contentType === 'vk_video' && 'Вставьте ссылку на видео из ВКонтакте'}
                {contentType === 'yandex_disk' && 'Вставьте ссылку на файл с Яндекс.Диска'}
              </p>
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            💰 Настройки урока
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                Цена (₽)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                Установите 0 для бесплатного урока
              </p>
            </div>

            <div className="flex items-center">
              <input
                id="isFreePreview"
                type="checkbox"
                checked={isFreePreview}
                onChange={(e) => setIsFreePreview(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isFreePreview" className="ml-2 block text-sm text-gray-700">
                Сделать бесплатным превью
              </label>
              <p className="text-sm text-gray-500 ml-6">
                Пользователи смогут посмотреть урок бесплатно перед покупкой
              </p>
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <Link
            href="/dashboard/mentor/lessons"
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
          >
            Отмена
          </Link>
        </div>
      </form>
    </main>
  )
}