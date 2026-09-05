'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FileUploader from '@/components/FileUploader'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Button } from '@/components/ui/Button'

// На платформе только текстовые уроки: тип контента не выбирается,
// текст пишется в WYSIWYG-редакторе на странице урока.

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
        .maybeSingle()

      if (coach) {
        setCoachId(coach.id)
      } else {
        setError('Ваш профиль автора не найден. Обратитесь к администратору.')
      }
    }
    getCoachId()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 🛡️ Предотвращаем двойное выполнение (исправление дублирования)
    if (loading) return

    setError('')

    if (!coachId) {
      setError('Ошибка: профиль автора не найден')
      return
    }

    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    setLoading(true)

    try {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
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

      // Текстовый урок создаём без контента: текст пишется в WYSIWYG-редакторе —
      // сразу ведём на страницу редактирования
      router.push(`/dashboard/mentor/lessons/${lesson.id}/edit`)
    } catch (error: any) {
      console.error('Error creating lesson:', error)
      setError(error.message || 'Ошибка при создании урока')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />

      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-8">Создание нового урока</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-[box-shadow,border-color,background-color,color]"
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
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-[box-shadow,border-color,background-color,color]"
                placeholder="Краткое описание урока..."
              />
            </div>
          </div>
        </div>

        {/* Контент урока — только текст в WYSIWYG-редакторе */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Контент урока</h2>
          <div className="flex items-start gap-3 bg-purple-50/50 border border-purple-100 rounded-xl p-4">
            <span className="text-xl leading-none mt-0.5">📝</span>
            <p className="text-sm text-gray-600">
              Урок — это статья в визуальном редакторе. Сразу после создания урока
              откроется страница редактирования, где вы напишете текст: заголовки,
              списки, картинки и видео прямо в тексте.
            </p>
          </div>
        </div>

        {/* Цена и доступ */}
        <div className="style-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Цена и доступ</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1">Цена урока, ₽</label>
              <input
                id="price"
                type="number"
                min="0"
                step="100"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-[box-shadow,border-color,background-color,color]"
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
                      className="h-5 w-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="isFreePreview" className="font-semibold text-gray-900 cursor-pointer">Открыть целиком как бесплатный образец</label>
                    <p className="text-gray-500 mt-0.5">Урок полностью доступен без покупки — например, чтобы студент оценил стиль автора перед курсом</p>
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
        </div>

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button type="submit" loading={loading} className="flex-1 sm:flex-none">
            {loading ? 'Создание...' : 'Создать урок'}
          </Button>

          <Button href="/dashboard/mentor/lessons" variant="outline" className="flex-1 sm:flex-none">
            Отмена
          </Button>
        </div>
      </form>
    </main>
  )
}