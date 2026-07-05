import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface CoursePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Получаем данные курса
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(`
      *,
      coaches (
        id,
        display_name,
        specialization,
        bio
      )
    `)
    .eq('id', id)
    .single()

  if (courseError || !course) {
    notFound()
  }

  // Если курс не опубликован — показываем 404 (кроме владельца)
  if (!course.is_published) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      notFound()
    }
    
    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (coach?.id !== course.coach_id) {
      notFound()
    }
  }

  // Получаем уроки курса
  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      order_index,
      lesson_content (
        content_type,
        content_url
      )
    `)
    .eq('course_id', id)
    .order('order_index', { ascending: true })

  const lessonsCount = lessons?.length || 0

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero секция с обложкой */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {course.title}
            </h1>
            
            {course.coaches && (
              <Link
                href={`/mentor/${course.coaches.id}`}
                className="inline-flex items-center gap-2 text-blue-100 hover:text-white mb-6 transition-colors"
              >
                <span className="text-xl">👨‍🏫</span>
                <span className="font-medium">{course.coaches.display_name}</span>
                {course.coaches.specialization && (
                  <span className="text-blue-200">— {course.coaches.specialization}</span>
                )}
              </Link>
            )}

            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📚</span>
                <span className="text-lg">{lessonsCount} {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <span className="text-2xl font-bold">
                  {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Левая колонка: Описание и уроки */}
          <div className="lg:col-span-2 space-y-6">
            {/* Описание курса */}
            {course.description && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  📖 О курсе
                </h2>
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {course.description}
                </div>
              </div>
            )}

            {/* Программа курса */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                📚 Программа курса
              </h2>

              {lessons && lessons.length > 0 ? (
                <div className="space-y-4">
                  {lessons.map((lesson, index) => {
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
                        className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">{icon}</span>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {lesson.title}
                              </h3>
                            </div>
                            
                            {lesson.description && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {lesson.description}
                              </p>
                            )}

                            <div className="flex items-center gap-3 flex-wrap">
                              {lesson.is_free_preview && (
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                                  🆓 Бесплатный превью
                                </span>
                              )}
                              <span className="text-sm text-gray-500">
                                {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
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
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-gray-600">
                    Уроки курса будут добавлены скоро
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Правая колонка: Информация о наставнике и покупка */}
          <div className="space-y-6">
            {/* Карточка наставника */}
            {course.coaches && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  👨‍🏫 Ваш наставник
                </h3>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {course.coaches.display_name?.charAt(0).toUpperCase() || '👤'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {course.coaches.display_name}
                    </p>
                    {course.coaches.specialization && (
                      <p className="text-sm text-gray-600">
                        {course.coaches.specialization}
                      </p>
                    )}
                  </div>
                </div>

                {course.coaches.bio && (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {course.coaches.bio}
                  </p>
                )}

                <Link
                  href={`/mentor/${course.coaches.id}`}
                  className="mt-4 block text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Смотреть профиль →
                </Link>
              </div>
            )}

            {/* Карточка покупки */}
            <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-4">
              <div className="mb-6">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                </div>
                <p className="text-gray-600">
                  {lessonsCount} {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}
                </p>
              </div>

              {/* Кнопки действий */}
              <div className="space-y-3">
                {course.price === 0 ? (
                  <Link
                    href={`/lesson/${lessons?.[0]?.id || ''}`}
                    className="block w-full bg-green-600 text-white text-center px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                     Начать обучение
                  </Link>
                ) : (
                  <>
                    <button
                      className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      onClick={() => alert('Функция оплаты будет добавлена позже')}
                    >
                      💳 Купить курс
                    </button>
                    
                    {lessons && lessons.length > 0 && (
                      <Link
                        href={`/lesson/${lessons[0].id}`}
                        className="block w-full bg-gray-100 text-gray-700 text-center px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        📖 Посмотреть первый урок
                      </Link>
                    )}
                  </>
                )}
              </div>

              {/* Что входит в курс */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-gray-900 mb-3">
                  Что входит в курс:
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>{lessonsCount} видео-уроков</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Доступ навсегда</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Материалы для скачивания</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Поддержка наставника</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}