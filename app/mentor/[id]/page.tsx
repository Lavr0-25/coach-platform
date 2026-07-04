import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface LessonPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Получаем урок
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single()

  if (lessonError || !lesson) {
    console.error('Error loading lesson:', lessonError)
    notFound()
  }

  // Получаем наставника
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name, specialization')
    .eq('id', lesson.coach_id)
    .single()

  // Получаем контент
  const { data: content } = await supabase
    .from('lesson_content')
    .select('*')
    .eq('lesson_id', id)
    .order('order_index', { ascending: true })
    .limit(1)

  const isFree = lesson.price === 0 || lesson.is_free_preview

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/catalog" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к каталогу
        </Link>
      </div>

      {/* Заголовок */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {lesson.title}
        </h1>
        
        {coach && (
          <p className="text-gray-600 mb-4">
            👨‍🏫 {coach.display_name}
            {coach.specialization && ` — ${coach.specialization}`}
          </p>
        )}

        <div className="flex items-center gap-4">
          {isFree ? (
            <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-lg">
              🆓 Бесплатно
            </span>
          ) : (
            <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-lg">
              💰 {lesson.price} ₽
            </span>
          )}
          
          <span className="text-sm text-gray-500">
            📅 {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
          </span>
        </div>
      </div>

      {/* Видео/Контент */}
      {content && content.length > 0 && content[0].content_url ? (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📺 Контент урока
          </h2>
          
          {content[0].content_type === 'youtube' && (
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                src={content[0].content_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {content[0].content_type === 'vk_video' && (
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                src={content[0].content_url}
                className="w-full h-full"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {!['youtube', 'vk_video'].includes(content[0].content_type) && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-700 mb-4">
                Тип контента: {content[0].content_type}
              </p>
              <a
                href={content[0].content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block"
              >
                📥 Открыть контент
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <p className="text-yellow-800">
            ⚠️ Контент урока не найден. Пожалуйста, отредактируйте урок и добавьте видео.
          </p>
        </div>
      )}

      {/* Описание */}
      {lesson.description && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📖 Описание
          </h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {lesson.description}
          </p>
        </div>
      )}
    </main>
  )
}