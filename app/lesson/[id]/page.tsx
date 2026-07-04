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
  console.log('🔍 Загрузка урока с ID:', id)
  
  const supabase = await createClient()

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single()

  console.log('📦 Результат:', { lesson, error: lessonError })

  if (lessonError || !lesson) {
    console.error('❌ Ошибка:', lessonError)
    notFound()
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('id', lesson.coach_id)
    .single()

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

      {/* Карточка урока */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {lesson.title}
        </h1>
        
        {coach && (
          <Link 
            href={`/mentor/${coach.id}`}
            className="text-gray-600 hover:text-blue-600 mb-4 inline-block transition-colors"
          >
            👨‍🏫 {coach.display_name}
          </Link>
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
        </div>
      </div>

      {/* Видео */}
      {content && content.length > 0 && content[0].content_type === 'youtube' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <iframe
              src={content[0].content_url}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Описание */}
      {lesson.description && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📖 Описание
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {lesson.description}
          </p>
        </div>
      )}
    </main>
  )
}