import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface MentorPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    search?: string
  }>
}

export default async function MentorPage({ params, searchParams }: MentorPageProps) {
  const { id } = await params
  const { search = '' } = await searchParams
  const supabase = await createClient()

  // Получаем данные автора
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, user_id, display_name, avatar_url, bio, specialization, created_at')
    .eq('id', id)
    .single()

  if (coachError || !coach) {
    notFound()
  }

  // Получаем курсы автора
  let coursesQuery = supabase
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

  // Применяем поиск к курсам
  if (search.trim()) {
    coursesQuery = coursesQuery.ilike('title', `%${search.trim()}%`)
  }

  const { data: courses } = await coursesQuery
    .order('created_at', { ascending: false })

  // Получаем отдельные уроки автора
  let lessonsQuery = supabase
    .from('lessons')
    .select('id, title, description, price, is_free_preview, created_at, cover_image')
    .eq('coach_id', coach.id)
    .is('course_id', null)

  // Применяем поиск к урокам
  if (search.trim()) {
    lessonsQuery = lessonsQuery.ilike('title', `%${search.trim()}%`)
  }

  const { data: lessons } = await lessonsQuery
    .order('created_at', { ascending: false })

  const coursesCount = courses?.length || 0
  const lessonsCount = lessons?.length || 0

  // Получаем статистику (общее количество студентов)
  const { data: progressData } = await supabase
    .from('lesson_progress')
    .select('user_id', { count: 'exact' })
    .in('lesson_id', [
      ...(courses?.flatMap(c => c.lessons || []) || []),
      ...(lessons || [])
    ].map(l => l.id))

  const uniqueStudents = new Set(progressData?.map(p => p.user_id) || []).size

  // Рассчитываем "стаж" автора
  const experienceYears = coach.created_at 
    ? Math.floor((new Date().getTime() - new Date(coach.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0

  const getInitials = (name?: string | null) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/mentors" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к авторам
        </Link>
      </div>

      {/* Профиль автора с расширенной информацией */}
      <div className="style-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          {/* Аватар */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              {coach.avatar_url ? (
                <img src={coach.avatar_url} alt={coach.display_name || ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl sm:text-6xl font-bold text-purple-600">
                  {getInitials(coach.display_name)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            {/* Имя и специализация */}
            <div className="mb-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                {coach.display_name || 'Автор'}
              </h1>
              {coach.specialization && (
                <p className="text-lg text-purple-600 font-medium">{coach.specialization}</p>
              )}
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{coursesCount}</div>
                <div className="text-sm text-gray-600">
                  {coursesCount === 1 ? 'курс' : coursesCount < 5 ? 'курса' : 'курсов'}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{lessonsCount}</div>
                <div className="text-sm text-gray-600">
                  {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{uniqueStudents}</div>
                <div className="text-sm text-gray-600">
                  {uniqueStudents === 1 ? 'студент' : uniqueStudents < 5 ? 'студента' : 'студентов'}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{experienceYears}+</div>
                <div className="text-sm text-gray-600">лет на платформе</div>
              </div>
            </div>

            {/* Биография */}
            {coach.bio && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Обо мне</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
              </div>
            )}

            {/* Достижения и информация */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {experienceYears > 0 && (
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                  <div className="w-10 h-10 gradient-icon rounded-lg flex items-center justify-center text-white">
                    
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Опыт работы</div>
                    <div className="text-sm text-gray-600">{experienceYears}+ лет на платформе</div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                <div className="w-10 h-10 gradient-icon rounded-lg flex items-center justify-center text-white">
                  
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Активных студентов</div>
                  <div className="text-sm text-gray-600">{uniqueStudents} человек обучается</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Поиск по контенту автора */}
      <div className="mb-8">
        <div className="relative">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Поиск по курсам и урокам автора..."
            className="w-full px-5 py-3 pl-12 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <svg 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <Link
              href={`/mentor/${id}`}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          )}
        </div>

        {search && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Найдено: <span className="font-bold text-purple-700">{coursesCount + lessonsCount}</span> материалов
            </p>
            <Link
              href={`/mentor/${id}`}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Сбросить поиск
            </Link>
          </div>
        )}
      </div>

      {/* Курсы автора */}
      {coursesCount > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold gradient-text flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📚</span>
              Курсы автора {search && <span className="text-base text-gray-500">({coursesCount})</span>}
            </h2>
          </div>

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
                      <div className="w-full h-full flex items-center justify-center text-white text-6xl opacity-50"></div>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold gradient-text flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📝</span>
              Отдельные уроки {search && <span className="text-base text-gray-500">({lessonsCount})</span>}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons?.map((lesson: any) => {
              return (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
                >
                  <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                    {lesson.cover_image ? (
                      <img 
                        src={lesson.cover_image} 
                        alt={lesson.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="opacity-50">📝</span>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {lesson.title}
                  </h3>
                  
                  {lesson.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {lesson.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                    <div className="flex items-center gap-2">
                      {lesson.is_free_preview ? (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                          Бесплатно
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-purple-700">
                          {lesson.price} ₽
                        </span>
                      )}
                    </div>
                    
                    <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Подробнее
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Если нет материалов или ничего не найдено */}
      {coursesCount === 0 && lessonsCount === 0 && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {search ? 'Ничего не найдено' : 'Пока нет материалов'}
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            {search 
              ? `По запросу "${search}" материалов не найдено. Попробуйте изменить поисковый запрос.`
              : 'Автор пока не добавил курсы или уроки'
            }
          </p>
          {search && (
            <Link
              href={`/mentor/${id}`}
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-block mt-6"
            >
              Сбросить поиск
            </Link>
          )}
        </div>
      )}
    </main>
  )
} 