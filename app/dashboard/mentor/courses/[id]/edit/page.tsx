'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateCourse, attachLessonToCourse, detachLessonFromCourse, reorderCourseLessons, setCoursePublished } from '@/app/actions/updateCourse'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FileUploader from '@/components/FileUploader'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

interface Course {
  id: string
  title: string
  description: string
  price: number
  is_published: boolean
  cover_image_url: string | null
  cover_image: string | null
  coach_id: string
}

interface Lesson {
  id: string
  title: string
  description: string
  price: number
  is_free_preview: boolean
  order_index: number
  course_id: string | null
}

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  if (!resolvedParams) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Загрузка...</p>
        </div>
      </div>
    )
  }

  return <EditCourseForm courseId={resolvedParams.id} />
}

function EditCourseForm({ courseId }: { courseId: string }) {
  const toast = useToast()
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Данные курса
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isPublished, setIsPublished] = useState(false)
  const [coverImageUrl, setCoverImageUrl] = useState('')
  
  // Уроки курса
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([])
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([])
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([])
  const [showAddLesson, setShowAddLesson] = useState(false)
  const [lessonSearch, setLessonSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  // Фильтрация уроков при изменении поиска
  useEffect(() => {
    if (lessonSearch.trim()) {
      const search = lessonSearch.toLowerCase()
      setFilteredLessons(
        availableLessons.filter(lesson =>
          lesson.title.toLowerCase().includes(search) ||
          (lesson.description && lesson.description.toLowerCase().includes(search))
        )
      )
    } else {
      setFilteredLessons(availableLessons)
    }
  }, [lessonSearch, availableLessons])

  const loadData = async () => {
    try {
      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Пользователь не найден')

      // Получаем coach_id (maybeSingle: 0 строк → null без ошибки 406)
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!coach) throw new Error('Coach не найден')

      // Загружаем курс (maybeSingle — курс мог быть удалён)
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle()

      if (courseError) throw courseError

      if (!course) {
        setError('Курс не найден — возможно, он был удалён. Откройте «Мои курсы» заново.')
        return
      }

      if (course) {
        setTitle(course.title || '')
        setDescription(course.description || '')
        setPrice(course.price?.toString() || '0')
        setIsPublished(course.is_published || false)
        setCoverImageUrl(course.cover_image_url || course.cover_image || '')
      }

      // Уроки курса — через связку course_lessons: один урок может быть в нескольких курсах
      const { data: links } = await supabase
        .from('course_lessons')
        .select('order_index, lessons(*)')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      const inCourseLessons = (links || [])
        .map((row: any) => row.lessons as Lesson)
        .filter(l => l && l.id)

      setCourseLessons(inCourseLessons)

      // Доступные для добавления: свои уроки минус уже добавленные в ЭТОТ курс
      const { data: own } = await supabase
        .from('lessons')
        .select('*')
        .eq('coach_id', coach.id) // ← Только свои уроки!
        .order('created_at', { ascending: false })

      const inCourseIds = new Set(inCourseLessons.map(l => l.id))
      const availableList = (own || []).filter(l => !inCourseIds.has(l.id))

      setAvailableLessons(availableList)
      setFilteredLessons(availableList)
    } catch (error: any) {
      console.error('Error loading course:', error)
      setError('Ошибка загрузки курса')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!title.trim()) {
      setError('Введите название курса')
      return
    }

    setSaving(true)

    const result = await updateCourse(courseId, {
      title: title.trim(),
      description: description.trim() || null,
      price: parseFloat(price) || 0,
      is_published: isPublished,
      cover_image_url: coverImageUrl.trim() || null,
    })

    if (!result.ok) {
      console.error('Error updating course:', result.error)
      setError(result.error)
    } else {
      setSuccess('✅ Курс успешно обновлён!')
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  const handleTogglePublish = async () => {
    setPublishing(true)
    const result = await setCoursePublished(courseId, !isPublished)
    if (!result.ok) {
      setError(result.error)
    } else {
      const nowPublished = !isPublished
      setIsPublished(nowPublished)
      setSuccess(nowPublished ? '✅ Курс опубликован — теперь его видят студенты' : 'Курс снят с публикации — студенты его больше не видят')
      setTimeout(() => setSuccess(''), 3000)
    }
    setPublishing(false)
  }

  const handleAddLesson = async (lessonId: string) => {
    const result = await attachLessonToCourse(courseId, lessonId)

    if (!result.ok) {
      console.error('Error adding lesson:', result.error)
      toast.showToast(result.error, 'info')
      return
    }

    const lesson = availableLessons.find(l => l.id === lessonId)
    if (lesson) {
      // order_index считает сервер — читаем фактическое состояние курса заново
      await loadData()
    }

    setShowAddLesson(false)
    setLessonSearch('')
  }

  const handleRemoveLesson = async (lessonId: string) => {
    if (!confirm('Удалить урок из курса? Урок не будет удалён, только отвязан от курса.')) {
      return
    }

    const result = await detachLessonFromCourse(courseId, lessonId)

    if (!result.ok) {
      console.error('Error removing lesson:', result.error)
      toast.showToast(result.error, 'info')
      return
    }

    // Список доступных уроков читаем заново — сервер отработал отвязку
    await loadData()
  }

  const handleMoveLesson = async (lessonId: string, direction: 'up' | 'down') => {
    const currentIndex = courseLessons.findIndex(l => l.id === lessonId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= courseLessons.length) return

    const newLessons = [...courseLessons]
    const [movedLesson] = newLessons.splice(currentIndex, 1)
    newLessons.splice(newIndex, 0, movedLesson)

    // Оптимистично показываем новый порядок, сервер подтверждает
    setCourseLessons(newLessons.map((lesson, index) => ({ ...lesson, order_index: index + 1 })))

    const result = await reorderCourseLessons(courseId, newLessons.map(l => l.id))

    if (!result.ok) {
      console.error('Error reordering lessons:', result.error)
      toast.showToast(result.error, 'info')
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Загрузка курса...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-gray-900 font-medium">Редактировать курс</span>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/course/${courseId}?view=preview`}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-colors inline-flex items-center gap-2"
            target="_blank"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">Как видят студенты</span>
          </Link>
        </div>
      </div>

      {/* Статус публикации: всегда виден, меняется отдельной кнопкой (не через «Сохранить») */}
      <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isPublished ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">{isPublished ? '🟢' : '🟡'}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {isPublished ? 'Курс опубликован' : 'Курс — черновик'}
            </p>
            <p className="text-sm text-gray-600">
              {isPublished
                ? 'Курс виден студентам в каталоге'
                : 'Курс виден только вам — студенты его пока не видят'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleTogglePublish}
          loading={publishing}
          variant={isPublished ? 'outline' : 'primary'}
          className="border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap"
        >
          {publishing ? 'Меняем статус...' : isPublished ? 'Вернуть в черновик' : 'Опубликовать курс'}
        </Button>
      </div>

      {/* Уведомления */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка: Информация о курсе */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveCourse} className="style-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Информация о курсе
            </h2>
            
            <div className="space-y-5">
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                  Название курса *
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-[box-shadow,border-color,background-color,color]"
                  placeholder="Например: Телесная психология: основы"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Описание курса
                </label>
                <textarea
                  id="description"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-[box-shadow,border-color,background-color,color]"
                  placeholder="Опишите, чему научатся студенты..."
                />
              </div>

              <div>
                <FileUploader
                  currentFile={coverImageUrl}
                  onFileUpload={(url) => setCoverImageUrl(url)}
                  entityType="course_cover"
                  label="Обложка курса"
                  hint="PNG, JPG до 5MB (рекомендуется 1200×675px, 16:9)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-2">
                    Цена (руб.)
                  </label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="100"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-[box-shadow,border-color,background-color,color]"
                  />
                </div>
              </div>

              <Button type="submit" loading={saving} size="lg">
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </form>

          {/* Уроки курса */}
          <Card variant="glow" padding="none" className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </span>
                Уроки курса ({courseLessons.length})
              </h2>
              <button
                onClick={() => {
                  setShowAddLesson(true)
                  setLessonSearch('')
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Добавить урок
              </button>
            </div>

            {courseLessons.length > 0 ? (
              <div className="space-y-3">
                {courseLessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-4 p-4 bg-purple-50/30 rounded-xl border border-purple-100 hover:bg-purple-50 transition-colors group"
                  >
                    <div className="w-8 h-8 flex-shrink-0 gradient-icon rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                        {lesson.is_free_preview && ' • Превью'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveLesson(lesson.id, 'up')}
                        disabled={index === 0}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Вверх"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveLesson(lesson.id, 'down')}
                        disabled={index === courseLessons.length - 1}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Вниз"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveLesson(lesson.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить из курса"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-purple-50/30 rounded-xl border border-dashed border-purple-200">
                <div className="text-5xl mb-3"></div>
                <p className="text-gray-600 font-medium">В курсе пока нет уроков</p>
                <p className="text-sm text-gray-500 mt-1">Добавьте свои уроки, чтобы сформировать программу</p>
              </div>
            )}

            {/* Модальное окно добавления урока */}
            {showAddLesson && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card variant="glow" padding="none" className="max-w-2xl w-full max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-purple-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">
                      Добавить свой урок в курс
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddLesson(false)
                        setLessonSearch('')
                      }}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Поиск по своим урокам */}
                  <div className="p-4 border-b border-purple-100">
                    <div className="relative">
                      <input
                        type="text"
                        value={lessonSearch}
                        onChange={(e) => setLessonSearch(e.target.value)}
                        placeholder="Поиск по своим урокам..."
                        className="w-full px-4 py-2.5 pl-11 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        autoFocus
                      />
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Показаны только ваши уроки ({filteredLessons.length})
                    </p>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1">
                    {filteredLessons.length > 0 ? (
                      <div className="space-y-3">
                        {filteredLessons.map(lesson => (
                          <div
                            key={lesson.id}
                            className="bg-purple-50/30 rounded-xl p-4 flex items-center justify-between border border-purple-100 hover:bg-purple-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {lesson.title}
                              </h4>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                                {lesson.is_free_preview && ' • Превью'}
                              </p>
                            </div>
                            <Button size="sm" onClick={() => handleAddLesson(lesson.id)} className="flex-shrink-0">
                              Добавить
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-5xl mb-3"></div>
                        <p className="text-gray-600 font-medium mb-4">
                          {lessonSearch ? 'Уроки не найдены' : 'Нет доступных уроков'}
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          {lessonSearch 
                            ? 'Попробуйте изменить поисковый запрос'
                            : 'Сначала создайте уроки, затем добавьте их в курс'
                          }
                        </p>
                        <Link
                          href="/dashboard/mentor/lessons/new"
                          className="text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
                          onClick={() => setShowAddLesson(false)}
                        >
                          Создать новый урок
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </Card>
        </div>

        {/* Правая колонка: Статистика */}
        <div className="space-y-6">
          <Card variant="glow" padding="none" className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Статистика курса
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Уроков:</span>
                <span className="font-bold text-gray-900">{courseLessons.length}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Статус:</span>
                {isPublished ? (
                  <Badge variant="greenFill">
                    Опубликован
                  </Badge>
                ) : (
                  <Badge variant="grayFill">
                    Черновик
                  </Badge>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Цена:</span>
                <span className="font-bold text-gray-900">
                  {price === '0' ? 'Бесплатно' : `${price} ₽`}
                </span>
              </div>
            </div>
          </Card>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Совет</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Добавьте минимум 3 урока в курс, чтобы он выглядел полноценным. Опубликуйте курс, когда он будет готов к показу студентам.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}