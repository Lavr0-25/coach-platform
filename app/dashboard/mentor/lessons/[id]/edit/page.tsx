'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateLesson, setLessonPublished } from '@/app/actions/updateLesson'
import { deleteLesson } from '@/app/actions/deleteLesson'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUploader from '@/components/FileUploader'
import RichTextEditor from '@/components/editor/RichTextEditor'

const CONTENT_TYPES = [
  {
    value: 'video',
    label: '🎥 Видео',
    hint: 'Ссылка на видео (YouTube, VK Видео, RuTube, Дзен или другая площадка)',
    placeholder: 'https://...'
  },
  {
    value: 'text',
    label: '📝 Текстовый урок',
    hint: 'Статья в визуальном редакторе: заголовки, списки, картинки и видео прямо в тексте',
    placeholder: ''
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
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [hasSavedContent, setHasSavedContent] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isFreePreview, setIsFreePreview] = useState(false)
  const [coverImage, setCoverImage] = useState('')

  const [contentType, setContentType] = useState('video')
  const [contentUrl, setContentUrl] = useState('')
  const [contentTitle, setContentTitle] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')

  useEffect(() => {
    loadLesson()
  }, [])

  const loadLesson = async () => {
    try {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .maybeSingle()

      if (lessonError) throw lessonError

      if (!lesson) {
        setError('Урок не найден — возможно, он был удалён. Откройте «Мои уроки» заново.')
        return
      }

      setTitle(lesson.title || '')
        setDescription(lesson.description || '')
        setPrice(lesson.price?.toString() || '0')
        setIsFreePreview(lesson.is_free_preview || false)
        setIsPublished(lesson.is_published || false)
        setCoverImage(lesson.cover_image || '')

        const { data: content } = await supabase
          .from('lesson_content')
          .select('*')
          .eq('lesson_id', lessonId)
          .order('order_index', { ascending: true })
          .limit(1)

        if (content && content.length > 0) {
          // Маппинг старых типов на новые, если в базе остались старые значения
          let type = content[0].content_type || 'video'
          if (['youtube', 'vk_video', 'vkvideo', 'vk'].includes(type)) type = 'video'
          if (['yandex_disk', 'presentation', 'yandexdisk', 'googledrive'].includes(type)) type = 'storage'

          setContentType(type)
          setContentUrl(content[0].content_url || '')
          setContentHtml(content[0].content_html || '')

          // Контент считается сохранённым, если запись непустая по сути:
          // текст — есть текст вне тегов, остальные — есть ссылка/файл
          const row = content[0]
          const nonEmpty = type === 'text'
            ? !!(row.content_html || '').replace(/<[^>]*>/g, '').trim()
            : !!(row.content_url || '').trim()
          setHasSavedContent(nonEmpty)
          
          // Если это файловый тип и URL есть, считаем его загруженным файлом для превью
          if (type === 'pdf' || type === 'image') {
            setUploadedFileUrl(content[0].content_url || '')
            setUploadedFileName(content[0].content_url ? decodeURIComponent(content[0].content_url.split('/').pop() || '') : '')
          }
        }
    } catch (error: any) {
      console.error('Error loading lesson:', error)
      setError('Ошибка загрузки урока')
    } finally {
      setLoading(false)
    }
  }

  const isFileType = contentType === 'pdf' || contentType === 'image'

  const handleTogglePublish = async () => {
    setPublishing(true)
    const result = await setLessonPublished(lessonId, !isPublished)
    if (!result.ok) {
      setError(result.error)
    } else {
      const nowPublished = !isPublished
      setIsPublished(nowPublished)
      setSuccess(nowPublished ? '✅ Урок опубликован — теперь его видят студенты' : 'Урок снят с публикации — студенты его больше не видят')
      setTimeout(() => setSuccess(''), 3000)
    }
    setPublishing(false)
  }

  const handleDelete = async () => {
    // Подтверждение: удаление необратимо, каскадом уходят контент и статистика
    const publishedWarning = isPublished
      ? '\n\nУрок опубликован — студенты его больше не увидят.'
      : ''
    if (!window.confirm(`Удалить урок «${title}»?${publishedWarning}\n\nДействие нельзя отменить.`)) {
      return
    }
    setDeleting(true)
    const result = await deleteLesson(lessonId)
    if (!result.ok) {
      setError(result.error)
      setDeleting(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    router.push('/dashboard/mentor/lessons')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    // Для файловых типов проверяем uploadedFileUrl, для остальных - contentUrl
    const finalUrl = isFileType ? uploadedFileUrl : contentUrl

    // Текстовый урок: проверяем, что в редакторе есть хоть какой-то текст
    // (Tiptap пустого документа отдаёт '<p></p>' — после снятия тегов остаётся пусто)
    if (contentType === 'text' && !contentHtml.replace(/<[^>]*>/g, '').trim()) {
      setError('Напишите текст урока в редакторе')
      return
    }

    if (!finalUrl.trim() && contentType !== 'text') {
      setError(isFileType ? 'Загрузите файл' : 'Введите ссылку на контент')
      return
    }

    setSaving(true)

    const result = await updateLesson(
      lessonId,
      {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        is_free_preview: isFreePreview,
        cover_image: coverImage || null,
      },
      {
        content_type: contentType,
        content_url: contentType === 'text' ? '' : finalUrl.trim(),
        title: contentTitle.trim() || null,
        content_html: contentType === 'text' ? contentHtml : null,
      }
    )

    if (!result.ok) {
      console.error('Error updating lesson:', result.error)
      setError(result.error)
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' }) // ошибка сверху страницы — не потеряется
      return
    }

    setHasSavedContent(true) // контент сохранён — публикация теперь разрешена
    setSuccess('Урок успешно обновлён!')
    setTimeout(() => {
      router.push('/dashboard/mentor/lessons')
    }, 2000)
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
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 pt-24 sm:pt-28 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
          <Link href="/dashboard/mentor" className="hover:text-purple-600 transition-colors">Кабинет автора</Link>
          <span>/</span>
          <Link href="/dashboard/mentor/lessons" className="hover:text-purple-600 transition-colors">Мои уроки</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Редактировать урок</span>
        </div>

        <Link
          href={`/lesson/${lessonId}`}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-colors inline-flex items-center gap-2 self-start sm:self-auto"
          target="_blank"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          <span className="hidden sm:inline">Как видят студенты</span>
        </Link>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-8">Редактировать урок</h1>

      {/* Статус публикации: всегда виден, меняется отдельной кнопкой (не через «Сохранить») */}
      <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isPublished ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">{isPublished ? '🟢' : '🟡'}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {isPublished ? 'Урок опубликован' : 'Урок — черновик'}
            </p>
            <p className="text-sm text-gray-600">
              {isPublished
                ? 'Урок виден студентам (в каталоге и на странице наставника)'
                : hasSavedContent
                  ? 'Урок виден только вам — студенты его пока не видят'
                  : 'Урок виден только вам — чтобы опубликовать, сначала заполните и сохраните контент'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleTogglePublish}
          disabled={publishing || (!isPublished && !hasSavedContent)}
          title={!isPublished && !hasSavedContent ? 'Сначала заполните и сохраните контент урока' : undefined}
          className={isPublished
            ? 'bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap'
            : 'gradient-btn text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-[box-shadow,border-color,background-color,color] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none whitespace-nowrap'}
        >
          {publishing ? 'Меняем статус...' : isPublished ? 'Вернуть в черновик' : 'Опубликовать урок'}
        </button>
      </div>

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
          <FileUploader
            currentFile={coverImage}
            onFileUpload={(url) => setCoverImage(url)}
            entityId={lessonId}
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
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
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
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
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
                    onClick={() => {
                      setContentType(type.value)
                      setContentUrl('')
                      setContentHtml('')
                      setUploadedFileUrl('')
                      setUploadedFileName('')
                    }}
                    className={`p-4 border-2 rounded-xl text-left transition-colors ${
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

            {/* Для файловых типов (PDF и Image) - показываем загрузчик */}
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
                  placeholder={contentType === 'pdf' ? 'Загрузите PDF файл (drag-and-drop или Ctrl+V)' : 'Загрузите изображение (drag-and-drop или Ctrl+V)'}
                />
              </div>
            )}

            {/* Для остальных типов (video, storage, other) - показываем поле для ссылки */}
            {!isFileType && contentType !== 'text' && (
              <div>
                <label htmlFor="contentUrl" className="block text-sm font-semibold text-gray-700 mb-1">
                  Ссылка на контент *
                </label>
                <input
                  id="contentUrl"
                  type="url"
                  required
                  value={contentUrl}
                  onChange={(e) => setContentUrl(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
                  placeholder={selectedContentType?.placeholder}
                />
              </div>
            )}

            {/* Текстовый урок — WYSIWYG-редактор */}
            {contentType === 'text' && (
              <div>
                <RichTextEditor value={contentHtml} onChange={setContentHtml} lessonId={lessonId} />
                <p className="text-sm text-gray-500 mt-2">
                  Совет: начните с заголовка (кнопка H1), картинки и видео вставляются кнопками на панели сверху
                </p>
              </div>
            )}

            {contentType !== 'text' && (
              <div>
                <label htmlFor="contentTitle" className="block text-sm font-semibold text-gray-700 mb-1">
                  Заголовок контента (необязательно)
                </label>
                <input
                  id="contentTitle"
                  type="text"
                  value={contentTitle}
                  onChange={(e) => setContentTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
                  placeholder="Например: Видеоурок №1"
                />
              </div>
            )}
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
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
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
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 transition-opacity text-center"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <Link
            href="/dashboard/mentor/lessons"
            className="bg-white text-gray-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-colors text-center"
          >
            Отмена
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-white text-red-600 border border-red-200 px-6 py-3 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto text-center whitespace-nowrap"
          >
            {deleting ? 'Удаление...' : 'Удалить урок'}
          </button>
        </div>
      </form>
    </main>
  )
}