import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface MentorPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function MentorPage({ params }: MentorPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Получаем данные наставника
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('*')
    .eq('id', id)
    .single()

  if (coachError || !coach) {
    notFound()
  }

  // Получаем все уроки этого наставника
  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      created_at,
      lesson_content (
        content_type,
        content_url
      )
    `)
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  const lessonsCount = lessons?.length || 0

  // Функция для правильного склонения слова "урок"
  const getLessonsWord = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'урок'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'урока'
    return 'уроков'
  }

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

      {/* Профиль наставника */}
      <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
        <div className="flex items-start gap-6 flex-col md:flex-row">
          {/* Аватар */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg">
              {coach.display_name?.charAt(0).toUpperCase() || '👤'}
            </div>
          </div>

          {/* Информация */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {coach.display_name}
            </h1>
            
            {coach.specialization && (
              <p className="text-lg text-gray-600 mb-4">
                {coach.specialization}
              </p>
            )}

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                <span className="text-xl">📚</span>
                <span className="font-medium">
                  {lessonsCount} {getLessonsWord(lessonsCount)}
                </span>
              </div>
            </div>

            {coach.bio && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <h3 className="font-semibold text-gray-900 mb-2">О себе</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {coach.bio}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Уроки наставника */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          📚 Уроки наставника
        </h2>

        {lessons && lessons.length > 0 ? (
          <div className="space-y-4">
            {lessons.map((lesson) => {
              const content = lesson.lesson_content?.[0]
              const contentType = content?.content_type || 'unknown'
              
              const contentIcon: Record<string, string> = {
                youtube: '🎥',
                vk_video: '📹',
                yandex_disk: '💾',
                pdf: '📄',
                image: '🖼️',
                presentation: '📊',
              }
              const icon = contentIcon[contentType] || '📎'

              return (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="block bg-gray-50 rounded-lg p-6 hover:bg-gray-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl flex-shrink-0">
                      {icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {lesson.title}
                      </h3>
                      
                      {lesson.description && (
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {lesson.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 flex-wrap">
                        {lesson.is_free_preview && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            🆓 Бесплатный превью
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          {lesson.price === 0 ? 'Бесплатно' : `💰 ${lesson.price} ₽`}
                        </span>
                        <span className="text-sm text-gray-500">
                          📅 {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-blue-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">
              У этого наставника пока нет уроков
            </p>
          </div>
        )}
      </div>
    </main>
  )
}