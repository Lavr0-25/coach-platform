'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CoverImageUploader from '@/components/CoverImageUploader'

const CONTENT_TYPES = [
  { 
    value: 'video', 
    label: '🎥 Видео', 
    hint: 'Ссылка на видео (YouTube, VK Видео, RuTube, Дзен или другая площадка)',
    placeholder: 'https://...'
  },
  { 
    value: 'pdf', 
    label: '📄 Документ PDF', 
    hint: 'Загрузите PDF файл или вставьте ссылку',
    placeholder: 'https://... или загрузите файл'
  },
  { 
    value: 'image', 
    label: '🖼️ Фото/Изображение', 
    hint: 'Загрузите изображение или вставьте ссылку',
    placeholder: 'https://... или загрузите файл'
  },
  { 
    value: 'storage', 
    label: '📁 Файловое хранилище', 
    hint: 'Ссылка на Яндекс.Диск, Google Drive или другое хранилище',
    placeholder: 'https://disk.yandex.ru/... или https://drive.google.com/...'
  },
  { 
    value: 'other', 
    label: '🔗 Другое', 
    hint: 'Любая другая ссылка',
    placeholder: 'https://...'
  },
]

export default function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  if (!resolvedParams) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
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

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isFreePreview, setIsFreePreview] = useState(false)
  const [coverImage, setCoverImage] = useState('')

  const [contentType, setContentType] = useState('video')
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
        setCoverImage(lesson.cover_image || '')

        const { data: content } = await supabase
          .from('lesson_content')
          .select('*')
          .eq('lesson_id', lessonId)
          .order('order_index', { ascending: true })
          .limit(1)

        if (content && content.length > 0) {
          setContentType(content[0].content_type || 'video')
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
      const { error: lessonError } = await supabase
        .from('lessons')
        .update({
          title: title.trim(),
          description: description.trim(),
          price: parseFloat(price) || 0,
          is_free_preview: isFreePreview,
          cover_image: coverImage || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lessonId)

      if (lessonError) throw lessonError

      const { data: existingContent } = await supabase
        .from('lesson_content')
        .select('id')
        .eq('lesson_id', lessonId)
        .single()

      let contentError

      if (existingContent) {
        const { error } = await supabase
          .from('lesson_content')
          .update({
            content_type: contentType,
            content_url: contentUrl.trim(),
          })
          .eq('id', existingContent.id)
        contentError = error
      } else {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка урока...</p>
        </div>
      </div>
    )
  }

  const selectedContentType = CONTENT_TYPES.find(t => t.value === contentType)

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 flex-wrap">
        <Link href="/dashboard/mentor" className="hover:text-purple-600 transition-colors">Кабинет автора</Link>
        <span>/</span>
        <Link href="/dashboard/mentor/lessons" className="hover:text-purple-600 transition-colors">Мои уроки</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Редактировать урок</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-8">Редактировать урок</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Обложка */}
        <div className="style-card p-6 sm:p-8">
          <CoverImageUploader
            currentImage={coverImage}
            onImageUpload={setCoverImage}
            entityId={lessonId}
            entityType="lesson"
          />
        </div>

        {/* Основная информация */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Основная информация</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1">Название урока *</label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                placeholder="Введите название урока"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1">Описание</label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                placeholder="Опишите, что будет в уроке..."
              />
            </div>
          </div>
        </div>

        {/* Контент урока */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Контент урока</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Тип контента</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setContentType(type.value)}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      contentType === type.value
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-purple-100 hover:border-purple-300 hover:bg-purple-50/30'
                    }`}
                  >
                    <div className="text-2xl mb-2">{type.label.split(' ')[0]}</div>
                    <div className="font-semibold text-gray-900 text-sm">{type.label.split(' ').slice(1).join(' ')}</div>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-3">{selectedContentType?.hint}</p>
            </div>

            <div>
              <label htmlFor="contentUrl" className="block text-sm font-semibold text-gray-700 mb-1">Ссылка на контент *</label>
              <input
                id="contentUrl"
                type="url"
                required
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                placeholder={selectedContentType?.placeholder}
              />
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Настройки урока</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1">Цена (₽)</label>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                placeholder="0"
              />
              <p className="text-sm text-gray-500 mt-1">Установите 0 для бесплатного урока</p>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="isFreePreview"
                  type="checkbox"
                  checked={isFreePreview}
                  onChange={(e) => setIsFreePreview(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="isFreePreview" className="font-semibold text-gray-700">Сделать бесплатным превью</label>
                <p className="text-gray-500">Пользователи смогут посмотреть урок бесплатно перед покупкой</p>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 transition-all text-center"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <Link
            href="/dashboard/mentor/lessons"
            className="bg-white text-gray-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all text-center"
          >
            Отмена
          </Link>
        </div>
      </form>
    </main>
  )
}