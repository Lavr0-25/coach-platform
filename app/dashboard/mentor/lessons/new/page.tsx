'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUpload from '@/components/FileUpload'
import CoverImageUploader from '@/components/CoverImageUploader'

const CONTENT_TYPES = [
  { value: 'youtube', label: '🎥 YouTube видео', hint: 'Вставьте ссылку на YouTube видео' },
  { value: 'vk_video', label: '📹 VK Видео', hint: 'Вставьте ссылку на видео ВКонтакте' },
  { value: 'yandex_disk', label: '📁 Яндекс.Диск', hint: 'Ссылка на папку Яндекс.Диска' },
  { value: 'pdf', label: '📄 PDF файл', hint: 'Загрузите PDF файл или вставьте ссылку' },
  { value: 'image', label: '🖼️ Изображение', hint: 'Загрузите изображение или вставьте ссылку' },
  { value: 'presentation', label: '📊 Презентация', hint: 'Ссылка на презентацию' },
]

export default function NewLessonPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [coachId, setCoachId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isFreePreview, setIsFreePreview] = useState(false)
  const [coverImage, setCoverImage] = useState('')
  
  const [contentType, setContentType] = useState('youtube')
  const [contentUrl, setContentUrl] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [contentTitle, setContentTitle] = useState('')
  
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')

  useEffect(() => {
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
        setError('Ваш профиль автора не найден. Обратитесь к администратору.')
      }
    }
    getCoachId()
  }, [])

  const isFileType = contentType === 'pdf' || contentType === 'image'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!coachId) {
      setError('Ошибка: профиль автора не найден')
      return
    }

    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    const finalUrl = isFileType ? (uploadedFileUrl || contentUrl) : contentUrl

    if (!finalUrl.trim()) {
      setError(isFileType ? 'Загрузите файл или вставьте ссылку' : 'Введите ссылку на контент')
      return
    }

    setLoading(true)

    try {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          course_id: null,
          module_id: null,
          coach_id: coachId,
          title: title.trim(),
          description: description.trim() || null,
          price: parseFloat(price) || 0,
          is_free_preview: isFreePreview,
          cover_image: coverImage || null, // <-- Сохраняем обложку
          order_index: 1,
        })
        .select()
        .single()

      if (lessonError) throw lessonError

      const { error: contentError } = await supabase
        .from('lesson_content')
        .insert({
          lesson_id: lesson.id,
          content_type: contentType,
          content_url: finalUrl.trim(),
          access_password: accessPassword.trim() || null,
          title: contentTitle.trim() || null,
          order_index: 1,
        })

      if (contentError) throw contentError

      alert('✅ Урок успешно создан!')
      router.push('/dashboard/mentor/lessons')
    } catch (error: any) {
      console.error('Error creating lesson:', error)
      setError(error.message || 'Ошибка при создании урока')
    } finally {
      setLoading(false)
    }
  }

  const selectedContentType = CONTENT_TYPES.find(t => t.value === contentType)

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 flex-wrap">
        <Link href="/dashboard/mentor" className="hover:text-purple-600 transition-colors">Кабинет автора</Link>
        <span>/</span>
        <Link href="/dashboard/mentor/lessons" className="hover:text-purple-600 transition-colors">Мои уроки</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Новый урок</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-8">Создание нового урока</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Обложка */}
        <div className="style-card p-6 sm:p-8">
          <CoverImageUploader
            currentImage={coverImage}
            onImageUpload={setCoverImage}
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
                placeholder="Например: Введение в профессию"
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
                placeholder="Краткое описание урока..."
              />
            </div>
          </div>
        </div>

        {/* Контент урока */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Контент урока</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="contentType" className="block text-sm font-semibold text-gray-700 mb-1">Тип контента *</label>
              <select
                id="contentType"
                value={contentType}
                onChange={(e) => {
                  setContentType(e.target.value)
                  if (e.target.value !== 'pdf' && e.target.value !== 'image') {
                    setUploadedFileUrl('')
                  }
                }}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all bg-white"
              >
                {CONTENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">{selectedContentType?.hint}</p>
            </div>

            {isFileType && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {contentType === 'pdf' ? '📄 Загрузите PDF файл' : '🖼️ Загрузите изображение'}
                </label>
                <FileUpload
                  onFileUpload={(url) => setUploadedFileUrl(url)}
                  existingFileUrl={uploadedFileUrl}
                  acceptedTypes={contentType === 'pdf' ? ['application/pdf'] : ['image/*']}
                  maxSizeMB={10}
                />
              </div>
            )}

            <div>
              <label htmlFor="contentUrl" className="block text-sm font-semibold text-gray-700 mb-1">
                {isFileType ? 'Ссылка на контент (альтернатива файлу)' : 'Ссылка на контент *'}
              </label>
              <input
                id="contentUrl"
                type="url"
                required={!isFileType && !uploadedFileUrl}
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                placeholder={contentType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
              />
            </div>

            {contentType === 'yandex_disk' && (
              <div>
                <label htmlFor="accessPassword" className="block text-sm font-semibold text-gray-700 mb-1">Пароль доступа к папке</label>
                <input
                  id="accessPassword"
                  type="text"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                  placeholder="Пароль от папки (если есть)"
                />
              </div>
            )}
          </div>
        </div>

        {/* Цена и доступ */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Цена и доступ</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1">Цена урока (руб.)</label>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                placeholder="0.00"
              />
              <p className="text-sm text-gray-500 mt-1">Оставьте 0, если урок бесплатный</p>
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
                <label htmlFor="isFreePreview" className="font-semibold text-gray-700">Бесплатный превью</label>
                <p className="text-gray-500">Этот урок будет доступен для просмотра без покупки</p>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 transition-all text-center"
          >
            {loading ? 'Создание...' : 'Создать урок'}
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