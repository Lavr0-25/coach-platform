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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
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
      // Загружаем курс
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

      // Загружаем уроки курса
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      setCourseLessons(lessons || [])

      // Загружаем доступные уроки (без курса)
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

      // Обновляем списки
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

      // Обновляем списки
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

    // Обновляем order_index
    const updatedLessons = newLessons.map((lesson, index) => ({
      ...lesson,
      order_index: index + 1,
    }))

    setCourseLessons(updatedLessons)

    // Сохраняем в БД
    try {
      const { error } = await supabase
        .from('lessons')
        .upsert(
          updatedLessons.map(l => ({
            id: l.id,
            course_id: courseId,
            order_index: l.order_index,
          }))
        )

      if (error) throw error
    } catch (error: any) {
      console.error('Error reordering lessons:', error)
      alert('Ошибка при изменении порядка')
      // Откатываем изменения
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка курса...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor" className="hover:text-blue-600">
          Кабинет наставника
        </Link>
        <span>/</span>
        <Link href="/dashboard/mentor/courses" className="hover:text-blue-600">
          Мои курсы
        </Link>
        <span>/</span>
        <span className="text-gray-900">Редактировать курс</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Редактировать курс
        </h1>
        
        <div className="flex gap-3">
          <Link
            href={`/course/${courseId}`}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            target="_blank"
          >
            👁️ Просмотреть
          </Link>
          <Link
            href="/dashboard/mentor/courses"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Назад
          </Link>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка: Информация о курсе */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveCourse} className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Информация о курсе
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Название курса *
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Описание курса
                </label>
                <textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  URL обложки
                </label>
                <input
                  id="coverImageUrl"
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/image.jpg"
                />
                
                {coverImageUrl && (
                  <div className="mt-4 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img 
                      src={coverImageUrl} 
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                    Цена (руб.)
                  </label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <div className="flex items-center h-10">
                    <input
                      id="isPublished"
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPublished" className="ml-2 text-sm text-gray-700">
                      Опубликован
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>

          {/* Уроки курса */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                📚 Уроки курса ({courseLessons.length})
              </h2>
              <button
                onClick={() => setShowAddLesson(!showAddLesson)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
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
                    className="bg-gray-50 rounded-lg p-4 flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {lesson.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                        {lesson.is_free_preview && ' • Превью'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMoveLesson(lesson.id, 'up')}
                        disabled={index === 0}
                        className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Вверх"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveLesson(lesson.id, 'down')}
                        disabled={index === courseLessons.length - 1}
                        className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Вниз"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveLesson(lesson.id)}
                        className="p-2 text-gray-600 hover:text-red-600"
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
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="text-4xl mb-2"></div>
                <p className="text-gray-600">
                  В курсе пока нет уроков
                </p>
              </div>
            )}

            {/* Модальное окно добавления урока */}
            {showAddLesson && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-gray-900">
                        Добавить урок в курс
                      </h3>
                      <button
                        onClick={() => setShowAddLesson(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {availableLessons.length > 0 ? (
                      <div className="space-y-3">
                        {availableLessons.map(lesson => (
                          <div
                            key={lesson.id}
                            className="bg-gray-50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">
                                {lesson.title}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAddLesson(lesson.id)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors ml-4"
                            >
                              Добавить
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-2">📭</div>
                        <p className="text-gray-600 mb-4">
                          Нет доступных уроков
                        </p>
                        <Link
                          href="/dashboard/mentor/lessons/new"
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Создать новый урок →
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
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              📊 Статистика курса
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Уроков:</span>
                <span className="font-bold text-gray-900">{courseLessons.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Статус:</span>
                {isPublished ? (
                  <span className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded">
                    Опубликован
                  </span>
                ) : (
                  <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-2 py-1 rounded">
                    Черновик
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Цена:</span>
                <span className="font-bold text-gray-900">
                  {price === '0' ? 'Бесплатно' : `${price} ₽`}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              💡 Совет
            </h3>
            <p className="text-sm text-blue-800">
              Добавьте минимум 3 урока в курс, чтобы он выглядел полноценным. 
              Опубликуйте курс, когда он будет готов к показу студентам.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}