'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewCoursePage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [coachId, setCoachId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Данные курса
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [isPublished, setIsPublished] = useState(false)
  const [coverImageUrl, setCoverImageUrl] = useState('')

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
        setError('Ваш профиль наставника не найден')
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
      setError('Введите название курса')
      return
    }

    setLoading(true)

    try {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          coach_id: coachId,
          title: title.trim(),
          description: description.trim() || null,
          price: parseFloat(price) || 0,
          is_published: isPublished,
          cover_image_url: coverImageUrl.trim() || null,
        })
        .select()
        .single()

      if (courseError) throw courseError

      alert('✅ Курс успешно создан!')
      router.push('/dashboard/mentor/courses')
    } catch (error: any) {
      console.error('Error creating course:', error)
      setError(error.message || 'Ошибка при создании курса')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
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
        <span className="text-gray-900">Новый курс</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Создание нового курса
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
                Название курса *
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Например: Телесная психология: основы"
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
                placeholder="Опишите, чему научатся студенты..."
              />
            </div>
          </div>
        </div>

        {/* Обложка */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Обложка курса
          </h2>
          
          <div>
            <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-1">
              URL изображения обложки
            </label>
            <input
              id="coverImageUrl"
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/image.jpg"
            />
            <p className="text-sm text-gray-500 mt-1">
              Оставьте пустым для использования обложки по умолчанию
            </p>
            
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
        </div>

        {/* Цена и публикация */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Цена и публикация
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                Цена курса (руб.)
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
                Оставьте 0, если курс бесплатный
              </p>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="isPublished"
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="isPublished" className="font-medium text-gray-700">
                  Опубликовать сразу
                </label>
                <p className="text-gray-500">
                  Курс будет виден всем пользователям
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
            {loading ? 'Создание...' : 'Создать курс'}
          </button>
          
          <Link
            href="/dashboard/mentor/courses"
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Отмена
          </Link>
        </div>
      </form>
    </main>
  )
}