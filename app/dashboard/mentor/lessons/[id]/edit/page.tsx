'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateLesson, setLessonPublished, setLessonPublishAt } from '@/app/actions/updateLesson'
import { deleteLesson } from '@/app/actions/deleteLesson'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUploader from '@/components/FileUploader'
import RichTextEditor from '@/components/editor/RichTextEditor'
import HiddenLessonPanel from '@/components/HiddenLessonPanel'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'

// На платформе только текстовые уроки: тип контента фиксирован ('text'),
// содержимое правится в WYSIWYG-редакторе. Старые не-текстовые записи в БД
// при загрузке просто не показывают поле ссылки — редактор текста основной.

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
  // Публикация по расписанию: момент из БД (ISO), открытая панель выбора и значение input
  const [publishAt, setPublishAt] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  // Фактический момент публикации (для статуса и карточек «Мои уроки»)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  // Скрытый режим: is_hidden + link_access из БД (панель сама вызывает экшены)
  const [isHidden, setIsHidden] = useState(false)
  const [linkAccess, setLinkAccess] = useState(true)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [hasSavedContent, setHasSavedContent] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isFreePreview, setIsFreePreview] = useState(false)
  const [coverImage, setCoverImage] = useState('')

  const [contentHtml, setContentHtml] = useState('')

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
        setPublishedAt(lesson.published_at || null)
        setPublishAt(lesson.publish_at || null)
        setIsHidden(lesson.is_hidden || false)
        setLinkAccess(lesson.link_access !== false)
        setCoverImage(lesson.cover_image || '')

        // Связь с курсом — отдельная join-таблица course_lessons
        const { data: courseLink } = await supabase
          .from('course_lessons')
          .select('course_id')
          .eq('lesson_id', lessonId)
          .limit(1)
        setCourseId(courseLink?.[0]?.course_id || null)

        const { data: content } = await supabase
          .from('lesson_content')
          .select('*')
          .eq('lesson_id', lessonId)
          .order('order_index', { ascending: true })
          .limit(1)

        if (content && content.length > 0) {
          setContentHtml(content[0].content_html || '')

          // Контент считается сохранённым, если в записи есть текст вне тегов
          const nonEmpty = !!(content[0].content_html || '').replace(/<[^>]*>/g, '').trim()
          setHasSavedContent(nonEmpty)
        }
  } catch (error: any) {
      console.error('Error loading lesson:', error)
      setError('Ошибка загрузки урока')
    } finally {
      setLoading(false)
    }
  }

  // Публикация по расписанию: ставим/отменяем publish_at (сервер проверит
  // права, черновик, контент и что время в будущем)
  const handleSchedule = async () => {
    if (!scheduleValue) return
    setScheduling(true)
    const wasPublished = isPublished
    const result = await setLessonPublishAt(lessonId, new Date(scheduleValue).toISOString())
    setScheduling(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setPublishAt(new Date(scheduleValue).toISOString())
    // Вариант А: расписание на опубликованном уроке снимает его с публикации —
    // планировщик откроет урок в назначенное время
    if (wasPublished) {
      setIsPublished(false)
      setPublishedAt(null)
      setSuccess('Урок снят с публикации и откроется сам в назначенное время')
    } else {
      setSuccess('Публикация запланирована — урок откроется сам в назначенное время')
    }
    setScheduleOpen(false)
    setScheduleValue('')
    setTimeout(() => setSuccess(''), 4000)
  }

  const handleCancelSchedule = async () => {
    setScheduling(true)
    const result = await setLessonPublishAt(lessonId, null)
    setScheduling(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setPublishAt(null)
    setScheduleOpen(false)
    setSuccess('Расписание отменено')
    setTimeout(() => setSuccess(''), 3000)
  }

  const formatSchedule = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })

  const handleTogglePublish = async () => {
    setPublishing(true)
    const result = await setLessonPublished(lessonId, !isPublished)
    if (!result.ok) {
      setError(result.error)
    } else {
      const nowPublished = !isPublished
      setIsPublished(nowPublished)
      if (nowPublished) {
        setPublishedAt(new Date().toISOString())
        setPublishAt(null)
      } else {
        setPublishedAt(null)
        setPublishAt(null)
      }
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

    // Текстовый урок: проверяем, что в редакторе есть хоть какой-то текст
    // (Tiptap пустого документа отдаёт '<p></p>' — после снятия тегов остаётся пусто)
    if (!contentHtml.replace(/<[^>]*>/g, '').trim()) {
      setError('Напишите текст урока в редакторе')
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
        content_type: 'text',
        content_url: '',
        title: null,
        content_html: contentHtml,
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

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 pt-24 sm:pt-28 max-w-4xl">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link
          href={`/lesson/${lessonId}`}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-colors inline-flex items-center gap-2 self-start sm:self-auto"
          target="_blank"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          <span className="hidden sm:inline">{isHidden ? 'Открыть урок' : 'Как видят студенты'}</span>
        </Link>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-8">Редактировать урок</h1>

      {/* Статус публикации: меняется отдельными кнопками (не через «Сохранить»).
          Скрытый режим управляется панелью внизу страницы — здесь только статус. */}
      {isHidden ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">🔒</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Урок скрыт</p>
              <p className="text-sm text-gray-600">
                Открыт только допущенным — настройка доступа внизу страницы, рядом с «Цена и доступ»
              </p>
            </div>
          </div>
        </div>
      ) : (
      <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isPublished ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">{isPublished ? '🟢' : publishAt ? '🗓' : '🟡'}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {isPublished
                ? publishedAt
                  ? `Урок опубликован: ${formatSchedule(publishedAt)}`
                  : 'Урок опубликован'
                : publishAt ? `Публикация запланирована: ${formatSchedule(publishAt)}` : 'Урок — черновик'}
            </p>
            <p className="text-sm text-gray-600">
              {isPublished
                ? 'Урок виден студентам (в каталоге и на странице наставника)'
                : publishAt
                  ? 'Урок откроется сам в назначенное время; до этого его видите только вы'
                  : hasSavedContent
                    ? 'Урок виден только вам — студенты его пока не видят'
                    : 'Урок виден только вам — чтобы опубликовать, сначала заполните и сохраните контент'}
            </p>
          </div>
        </div>
        {!isPublished && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Расписание: панель выбора времени / отмены */}
            {scheduleOpen ? (
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className="px-3 py-2 border border-purple-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                />
                <Button size="sm" onClick={handleSchedule} loading={scheduling} disabled={!scheduleValue} className="whitespace-nowrap">
                  {scheduling ? 'Сохраняю…' : 'Запланировать'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setScheduleOpen(false); setScheduleValue('') }}
                  className="text-gray-500 hover:text-gray-700 text-sm px-2 py-2 whitespace-nowrap"
                >
                  Отмена
                </button>
              </div>
            ) : publishAt ? (
              <button
                type="button"
                onClick={handleCancelSchedule}
                disabled={scheduling}
                className="bg-white text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {scheduling ? 'Отменяю…' : 'Отменить расписание'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                disabled={!hasSavedContent}
                title={!hasSavedContent ? 'Сначала заполните и сохраните контент урока' : 'Опубликовать автоматически в выбранное время'}
                className="bg-white text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                🗓 По расписанию
              </button>
            )}
            {/* Пока открыта панель расписания — «Опубликовать сейчас» скрываем:
                две кнопки рядом вводят в заблуждение (скрин из scrin_bag) */}
            {!scheduleOpen && (
              <Button
                type="button"
                onClick={handleTogglePublish}
                loading={publishing}
                disabled={!hasSavedContent}
                title={!hasSavedContent ? 'Сначала заполните и сохраните контент урока' : undefined}
                className="whitespace-nowrap"
              >
                {publishing ? 'Меняем статус...' : 'Опубликовать сейчас'}
              </Button>
            )}
          </div>
        )}
        {isPublished && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Расписание доступно и опубликованному уроку: установка снимает
                его с публикации сейчас, планировщик откроет в выбранное время */}
            {scheduleOpen ? (
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className="px-3 py-2 border border-purple-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                />
                <Button
                  size="sm"
                  onClick={handleSchedule}
                  loading={scheduling}
                  disabled={!scheduleValue}
                  title="Урок снимется с публикации сейчас и откроется сам в выбранное время"
                  className="whitespace-nowrap"
                >
                  {scheduling ? 'Сохраняю…' : 'Запланировать'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setScheduleOpen(false); setScheduleValue('') }}
                  className="text-gray-500 hover:text-gray-700 text-sm px-2 py-2 whitespace-nowrap"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                title="Урок снимется с публикации сейчас и откроется сам в выбранное время"
                className="bg-white text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                🗓 По расписанию
              </button>
            )}
            {/* Пока открыта панель расписания — «Вернуть в черновик» скрываем:
                две кнопки рядом вводят в заблуждение */}
            {!scheduleOpen && (
              <button
                type="button"
                onClick={handleTogglePublish}
                disabled={publishing}
                className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {publishing ? 'Меняем статус...' : 'Вернуть в черновик'}
              </button>
            )}
          </div>
        )}
      </div>
      )}

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
        <Card variant="glow" padding="none" className="p-6 sm:p-8">
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
        </Card>

        {/* Основная информация */}
        <Card variant="glow" padding="none" className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Основная информация</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1">Название урока *</label>
              <Input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название урока"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1">Описание</label>
              <Textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите, что будет в уроке..."
              />
            </div>
          </div>
        </Card>

        {/* Контент урока */}
        <Card variant="glow" padding="none" className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Контент урока</h2>
          <div className="space-y-6">
            {/* WYSIWYG-редактор — единственный тип контента */}
            <div>
              <RichTextEditor value={contentHtml} onChange={setContentHtml} lessonId={lessonId} />
              <p className="text-sm text-gray-500 mt-2">
                Совет: начните с заголовка (кнопка H1), картинки и видео вставляются кнопками на панели сверху
              </p>
            </div>
          </div>
        </Card>

        {/* Настройки */}
        <Card variant="glow" padding="none" className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Цена и доступ</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1">Цена урока, ₽</label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>

            {parseFloat(price) > 0 ? (
              <>
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-gray-900">💰 Платный урок — {price} ₽</p>
                  <p className="text-gray-500 mt-0.5">Студент покупает урок, чтобы смотреть. Поставьте 0 — урок станет бесплатным.</p>
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
                    <label htmlFor="isFreePreview" className="font-semibold text-gray-700 cursor-pointer">Открыть целиком как бесплатный образец</label>
                    <p className="text-gray-500">Урок полностью доступен без покупки — например, чтобы студент оценил стиль автора перед курсом</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-green-800">🟢 Бесплатный урок — открыт всем</p>
                <p className="text-green-700 mt-0.5">Укажите цену выше, чтобы сделать урок платным.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Скрытый режим: панель доступа (внизу, рядом с «Цена и доступ») */}
        <HiddenLessonPanel
          lessonId={lessonId}
          courseId={courseId}
          hasSavedContent={hasSavedContent}
          isHidden={isHidden}
          linkAccess={linkAccess}
          onHiddenChanged={(h) => { setIsHidden(h); setIsPublished(true) }}
        />

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button type="submit" loading={saving}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
          <Button href="/dashboard/mentor/lessons" variant="outline">
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            variant="dangerOutline"
            className="ml-auto whitespace-nowrap"
          >
            {deleting ? 'Удаление...' : 'Удалить урок'}
          </Button>
        </div>
      </form>
    </main>
  )
}