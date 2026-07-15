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

  // Получаем данные автора
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('*')
    .eq('id', id)
    .single()

  if (coachError || !coach) {
    notFound()
  }

  // Получаем курсы автора
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      description,
      price,
      is_published,
      cover_image_url,
      created_at,
      lessons (
        id
      )
    `)
    .eq('coach_id', coach.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Получаем уроки автора  (не в курсах)
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
    .is('course_id', null)
    .order('created_at', { ascending: false })

  const coursesCount = courses?.length || 0
  const lessonsCount = lessons?.length || 0

  // Функция для правильного склонения
  const getLessonsWord = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'урок'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'урока'
    return 'уроков'
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/catalog" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к каталогу
        </Link>
      </div>

      {/* Профиль автора */}
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

            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                <span className="text-xl">📚</span>
                <span className="font-medium">
                  {coursesCount} {coursesCount === 1 ? 'курс' : coursesCount < 5 ? 'курса' : 'курсов'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                <span className="text-xl">📖</span>
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

      {/* Курсы автора */}
      {coursesCount > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📚 Курсы автора
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses?.map((course) => {
              const courseLessonsCount = course.lessons?.length || 0
              
              return (
                <Link
                  key={course.id}
                  href={`/course/${course.id}`}
                  className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all group"
                >
                  {/* Обложка */}
                  <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 relative overflow-hidden">
                    {course.cover_image_url ? (
                      <img 
                        src={course.cover_image_url} 
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-6xl">
                        📚
                      </div>
                    )}
                    
                    <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-lg shadow-md">
                      <span className="font-bold text-gray-900">
                        {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                      </span>
                    </div>
                  </div>

                  {/* Информация */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {course.title}
                    </h3>

                    {course.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {course.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>📚</span>
                        <span>
                          {courseLessonsCount} {courseLessonsCount === 1 ? 'урок' : courseLessonsCount < 5 ? 'урока' : 'уроков'}
                        </span>
                      </div>
                      
                      <div className="text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                        Подробнее →
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Отдельные уроки автор */}
      {lessonsCount > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📖 Отдельные уроки
          </h2>

          <div className="bg-white rounded-xl shadow-sm border p-6">
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
              <div className="text-center py-8">
                <p className="text-gray-600">Нет отдельных уроков</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Если нет ни курсов, ни уроков */}
      {coursesCount === 0 && lessonsCount === 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Пока нет материалов
          </h2>
          <p className="text-gray-600">
            Автор пока не добавил курсы или уроки
          </p>
        </div>
      )}
    </main>
  )
}