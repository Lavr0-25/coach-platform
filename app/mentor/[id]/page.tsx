import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AuthorProfileHeader from '@/components/AuthorProfileHeader'

interface MentorPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function MentorPage({ params }: MentorPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Получаем текущего пользователя
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Получаем данные автора
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, user_id, display_name, avatar_url, bio, specialization, telegram_link, website_link')
    .eq('id', id)
    .single()

  if (coachError || !coach) {
    notFound()
  }

  // Проверка владельца (сравниваем id пользователя с user_id в таблице coaches)
  const isOwner = user?.id === coach.user_id

  // 3. Получаем курсы автора
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      description,
      price,
      cover_image,
      created_at,
      lessons (id)
    `)
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  // 4. Получаем уроки автора (не в курсах)
  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      cover_image,
      created_at
    `)
    .eq('coach_id', coach.id)
    .is('course_id', null)
    .order('created_at', { ascending: false })

  const coursesCount = courses?.length || 0
  const lessonsCount = lessons?.length || 0

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>
      </div>

      {/* Профиль автора (Клиентский компонент с режимом редактирования) */}
      <AuthorProfileHeader 
        coach={coach}
        coursesCount={coursesCount}
        lessonsCount={lessonsCount}
        isOwner={isOwner}
      />

      {/* Курсы автора */}
      {coursesCount > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📚</span>
            Курсы автора
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses?.map((course: any) => {
              const courseLessonsCount = course.lessons?.length || 0
              
              return (
                <Link
                  key={course.id}
                  href={`/course/${course.id}`}
                  className="style-card overflow-hidden hover:shadow-lg transition-all group border border-purple-100"
                >
                  <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 relative overflow-hidden">
                    {course.cover_image ? (
                      <img 
                        src={course.cover_image} 
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-6xl opacity-50">
                        📚
                      </div>
                    )}
                    
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                      {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {course.title}
                    </h3>

                    {course.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {course.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-purple-100">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>📖</span>
                        <span>
                          {courseLessonsCount} {courseLessonsCount === 1 ? 'урок' : courseLessonsCount < 5 ? 'урока' : 'уроков'}
                        </span>
                      </div>
                      
                      <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Подробнее 
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Отдельные уроки автора */}
      {lessonsCount > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📖</span>
            Отдельные уроки
          </h2>

          <div className="space-y-4">
            {lessons?.map((lesson: any) => {
              return (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="style-card p-5 hover:shadow-md transition-all group border border-purple-100 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="w-16 h-16 flex-shrink-0 gradient-icon rounded-xl flex items-center justify-center text-2xl text-white group-hover:scale-105 transition-transform">
                    📝
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 truncate group-hover:text-purple-600 transition-colors">
                      {lesson.title}
                    </h3>
                    
                    {lesson.description && (
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {lesson.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {lesson.is_free_preview && (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                          🆓 Бесплатный превью
                        </span>
                      )}
                      <span className="font-semibold text-purple-700">
                        {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                      </span>
                      <span className="text-gray-500">
                        {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-purple-600 group-hover:translate-x-1 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Если нет ни курсов, ни уроков */}
      {coursesCount === 0 && lessonsCount === 0 && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
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