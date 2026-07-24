'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CoverImageUploader from '@/components/CoverImageUploader'

export default function CreateCoursePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_image: '',
    price: 0,
    is_published: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Пользователь не найден')

      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!coach) throw new Error('Coach не найден')

      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          cover_image: formData.cover_image.trim() || null,
          price: formData.price,
          is_published: formData.is_published,
          coach_id: coach.id,
        })
        .select()
        .single()

      if (courseError) throw courseError

      router.push(`/dashboard/mentor/courses/${course.id}/edit`)
    } catch (err: any) {
      console.error('Error creating course:', err)
      setError(err.message || 'Ошибка при создании курса')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (imageUrl: string) => {
    setFormData({ ...formData, cover_image: imageUrl })
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <Link href="/dashboard/mentor/courses" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group mb-2">
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад к курсам
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
              Создать новый курс
            </h1>
            <p className="text-gray-600 mt-2">
              Заполните информацию о курсе и начните формировать программу
            </p>
          </div>
        </div>
      </div>

      {/* Уведомление об ошибке */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Форма создания курса */}
      <div className="style-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Основная информация */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Основная информация
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
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Например: Телесная психология: основы"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Придумайте яркое и понятное название
                </p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Описание курса
                </label>
                <textarea
                  id="description"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                  placeholder="Расскажите, о чем этот курс и чему научатся студенты..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Опишите программу, результаты обучения и целевую аудиторию
                </p>
              </div>
            </div>
          </div>

          {/* Обложка и цена */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              Обложка и цена
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Обложка курса
                </label>
                <CoverImageUploader
                  currentImage={formData.cover_image}
                  onImageUpload={handleImageUpload}
                  entityType="course"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Рекомендуемый размер: 1200×675px (16:9). Поддерживается загрузка файла и вставка скриншотов (Ctrl+V)
                </p>
              </div>

              <div>
                <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-2">
                  Цена курса (руб.)
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Укажите 0 для бесплатного курса
                </p>
              </div>
            </div>
          </div>

          {/* Публикация */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </span>
              Публикация
            </h2>

            <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-5">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="w-5 h-5 mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                    Опубликовать курс сразу
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Если снять галочку, курс сохранится как черновик и будет виден только вам
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-purple-100">
            <button
              type="submit"
              disabled={loading}
              className="gradient-btn text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Создание...
                </span>
              ) : (
                'Создать курс'
              )}
            </button>
            
            <Link
              href="/dashboard/mentor/courses"
              className="bg-white text-gray-700 border border-purple-200 px-8 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all text-center"
            >
              Отмена
            </Link>
          </div>
        </form>
      </div>

      {/* Подсказки */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Совет</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Добавьте минимум 3 урока перед публикацией курса, чтобы он выглядел полноценным
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Статистика</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Курсы с обложкой получают в 3 раза больше просмотров
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}