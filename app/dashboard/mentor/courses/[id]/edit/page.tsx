'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Course {
  id: string
  title: string
  description: string
  price: number
  is_published: boolean
  cover_image_url: string | null
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
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
  const [showAddLesson, setShowAddLesson] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError

      if (course) {
        setTitle(course.title || '')
        setDescription(course.description || '')
        setPrice(course.price?.toString() || '0')
        setIsPublished(course.is_published || false)
        setCoverImageUrl(course.cover_image_url || '')
      }

      const { data: lessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      setCourseLessons(lessons || [])

      const { data: available } = await supabase
        .from('lessons')
        .select('*')
        .is('course_id', null)
        .order('created_at', { ascending: false })

      setAvailableLessons(available || [])
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

    try {
      const { error } = await supabase
        .from('courses')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          price: parseFloat(price) || 0,
          is_published: isPublished,
          cover_image_url: coverImageUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)

      if (error) throw error

      setSuccess('✅ Курс успешно обновлён!')
    } catch (error: any) {
      console.error('Error updating course:', error)
      setError(error.message || 'Ошибка при сохранении курса')
    } finally {
      setSaving(false)
    }
  }

  const handleAddLesson = async (lessonId: string) => {
    try {
      const nextOrder = courseLessons.length + 1
      
      const { error } = await supabase
        .from('lessons')
        .update({
          course_id: courseId,
          order_index: nextOrder,
        })
        .eq('id', lessonId)

      if (error) throw error

      const lesson = availableLessons.find(l => l.id === lessonId)
      if (lesson) {
        setCourseLessons([...courseLessons, { ...lesson, course_id: courseId, order_index: nextOrder }])
        setAvailableLessons(availableLessons.filter(l => l.id !== lessonId))
      }

      setShowAddLesson(false)
    } catch (error: any) {
      console.error('Error adding lesson:', error)
      alert('Ошибка при добавлении урока')
    }
  }

  const handleRemoveLesson = async (lessonId: string) => {
    if (!confirm('Удалить урок из курса? Урок не будет удалён, только отвязан от курса.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('lessons')
        .update({
          course_id: null,
          order_index: 0,
        })
        .eq('id', lessonId)

      if (error) throw error

      const lesson = courseLessons.find(l => l.id === lessonId)
      if (lesson) {
        setAvailableLessons([...availableLessons, lesson])
        setCourseLessons(courseLessons.filter(l => l.id !== lessonId))
      }
    } catch (error: any) {
      console.error('Error removing lesson:', error)
      alert('Ошибка при удалении урока из курса')
    }
  }

  const handleMoveLesson = async (lessonId: string, direction: 'up' | 'down') => {
    const currentIndex = courseLessons.findIndex(l => l.id === lessonId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= courseLessons.length) return

    const newLessons = [...courseLessons]
    const [movedLesson] = newLessons.splice(currentIndex, 1)
    newLessons.splice(newIndex, 0, movedLesson)

    const updatedLessons = newLessons.map((lesson, index) => ({
      ...lesson,
      order_index: index + 1,
    }))

    setCourseLessons(updatedLessons)

    try {
      for (const lesson of updatedLessons) {
        const { error } = await supabase
          .from('lessons')
          .update({ order_index: lesson.order_index })
          .eq('id', lesson.id)

        if (error) throw error
      }
    } catch (error: any) {
      console.error('Error reordering lessons:', error)
      alert('Ошибка при изменении порядка')
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
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor" className="hover:text-purple-600 transition-colors">
          Кабинет наставника
        </Link>
        <span>/</span>
        <Link href="/dashboard/mentor/courses" className="hover:text-purple-600 transition-colors">
          Мои курсы
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Редактировать курс</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-1">
            Редактировать курс
          </h1>
          <p className="text-gray-600">Управление программой и материалами</p>
        </div>
        
        <div className="flex gap-3">
          <Link
            href={`/course/${courseId}?view=preview`}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-all inline-flex items-center gap-2"
            target="_blank"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">Как видят студенты</span>
          </Link>
          <Link
            href="/dashboard/mentor/courses"
            className="bg-white text-gray-700 border border-purple-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-50 transition-all"
          >
            Назад
          </Link>
        </div>
      </div>

      {/* Уведомления */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                  placeholder="Опишите, чему научатся студенты..."
                />
              </div>

              <div>
                <label htmlFor="coverImageUrl" className="block text-sm font-semibold text-gray-700 mb-2">
                  URL обложки
                </label>
                <input
                  id="coverImageUrl"
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="https://example.com/image.jpg"
                />
                
                {coverImageUrl && (
                  <div className="mt-4 aspect-video bg-gray-100 rounded-xl overflow-hidden border border-purple-200">
                    <img src={coverImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
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
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      id="isPublished"
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700 transition-colors">
                      {isPublished ? 'Опубликован' : 'Черновик'}
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto gradient-btn text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>

          {/* Уроки курса */}
          <div className="style-card p-6 sm:p-8">
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
                onClick={() => setShowAddLesson(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-all inline-flex items-center justify-center gap-2"
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
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-600 font-medium">В курсе пока нет уроков</p>
                <p className="text-sm text-gray-500 mt-1">Добавьте уроки, чтобы сформировать программу</p>
              </div>
            )}

            {/* Модальное окно добавления урока */}
            {showAddLesson && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="style-card max-w-2xl w-full max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-purple-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">
                      Добавить урок в курс
                    </h3>
                    <button
                      onClick={() => setShowAddLesson(false)}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1">
                    {availableLessons.length > 0 ? (
                      <div className="space-y-3">
                        {availableLessons.map(lesson => (
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
                              </p>
                            </div>
                            <button
                              onClick={() => handleAddLesson(lesson.id)}
                              className="gradient-btn text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex-shrink-0"
                            >
                              Добавить
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-5xl mb-3">📭</div>
                        <p className="text-gray-600 font-medium mb-4">Нет доступных уроков</p>
                        <Link
                          href="/dashboard/mentor/lessons/new"
                          className="text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
                        >
                          Создать новый урок
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка: Статистика */}
        <div className="space-y-6">
          <div className="style-card p-6">
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
                  <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    Опубликован
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    Черновик
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Цена:</span>
                <span className="font-bold text-gray-900">
                  {price === '0' ? 'Бесплатно' : `${price} ₽`}
                </span>
              </div>
            </div>
          </div>

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