import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface MentorPageProps {
  params: Promise<{ id: string }>
}

export default async function MentorPage({ params }: MentorPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Получаем данные автора
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, user_id, display_name, avatar_url, bio, specialization')
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
      cover_image,
      is_published,
      created_at,
      lessons(id)
    `)
    .eq('coach_id', coach.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Получаем отдельные уроки автора
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, description, price, is_free_preview, created_at')
    .eq('coach_id', coach.id)
    .is('course_id', null)
    .order('created_at', { ascending: false })

  const coursesCount = courses?.length || 0
  const lessonsCount = lessons?.length || 0

  const getInitials = (name?: string | null) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/mentors" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к авторам
        </Link>
      </div>

      {/* Профиль автора */}
      <div className="style-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center flex-shrink-0">
            {coach.avatar_url ? (
              <img src={coach.avatar_url} alt={coach.display_name || ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl sm:text-4xl font-bold text-purple-600">
                {getInitials(coach.display_name)}
              </span>
            )}
          </div>
          
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {coach.display_name || 'Автор'}
            </h1>
            {coach.specialization && (
              <p className="text-lg text-gray-600 mb-4">{coach.specialization}</p>
            )}
            
            <div className="flex flex-wrap gap-6 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{coursesCount}</div>
                <div className="text-sm text-gray-600">
                  {coursesCount === 1 ? 'курс' : coursesCount < 5 ? 'курса' : 'курсов'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{lessonsCount}</div>
                <div className="text-sm text-gray-600">
                  {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {coach.bio && (
          <div className="mt-6 pt-6 border-t border-purple-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Обо мне</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
          </div>
        )}
      </div>

      {/* Курсы автора */}
      {coursesCount > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"></span>
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
                      <img src={course.cover_image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-6xl opacity-50">📚</div>
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
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-purple-100">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>📖</span>
                        <span>{courseLessonsCount} {courseLessonsCount === 1 ? 'урок' : courseLessonsCount < 5 ? 'урока' : 'уроков'}</span>
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
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📝</span>
            Отдельные уроки
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons?.map((lesson: any) => (
              <Link
                key={lesson.id}
                href={`/lesson/${lesson.id}`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  <span className="opacity-50">📝</span>
                </div>
                
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {lesson.title}
                </h3>
                
                {lesson.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{lesson.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                  <div className="flex items-center gap-2">
                    {lesson.is_free_preview ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">Бесплатно</span>
                    ) : (
                      <span className="text-sm font-bold text-purple-700">{lesson.price} ₽</span>
                    )}
                  </div>
                  
                  <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Подробнее
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Если нет материалов */}
      {coursesCount === 0 && lessonsCount === 0 && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Пока нет материалов</h2>
          <p className="text-gray-600">Автор пока не добавил курсы или уроки</p>
        </div>
      )}
    </main>
  )
}