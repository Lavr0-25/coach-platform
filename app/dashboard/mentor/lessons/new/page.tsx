'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUploader from '@/components/FileUploader'

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
  
  const [contentType, setContentType] = useState('video')
  const [contentUrl, setContentUrl] = useState('')
  const [contentTitle, setContentTitle] = useState('')
  
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')

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
          cover_image: coverImage || null,
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
          <FileUploader
            currentFile={coverImage}
            onFileUpload={(url) => setCoverImage(url)}
            entityType="lesson_cover"
            acceptedTypes={['image/*']}
            maxSizeMB={5}
            label="Обложка урока"
            placeholder="Нажмите, перетащите или вставьте скриншот"
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
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Тип контента *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setContentType(type.value)
                      if (type.value !== 'pdf' && type.value !== 'image') {
                        setUploadedFileUrl('')
                        setUploadedFileName('')
                      }
                    }}
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

            {isFileType && (
              <div>
                <FileUploader
                  currentFile={uploadedFileUrl}
                  onFileUpload={(url, name) => {
                    setUploadedFileUrl(url)
                    setUploadedFileName(name)
                  }}
                  entityType="lesson_content"
                  acceptedTypes={contentType === 'pdf' ? ['application/pdf'] : ['image/*']}
                  maxSizeMB={10}
                  label={contentType === 'pdf' ? '📄 Загрузите PDF файл' : '🖼️ Загрузите изображение'}
                  placeholder={contentType === 'pdf' ? 'Загрузите PDF или вставьте ссылку' : 'Загрузите изображение или вставьте ссылку'}
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
                placeholder={selectedContentType?.placeholder}
              />
              {isFileType && (
                <p className="text-sm text-gray-500 mt-1">
                  💡 Можете загрузить файл выше ИЛИ вставить ссылку (файл имеет приоритет)
                </p>
              )}
            </div>
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