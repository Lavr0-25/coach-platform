import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MentorLessonsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Получаем coach_id
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('user_id', user.id)
    .single()

  if (!coach) {
    redirect('/dashboard/mentor')
  }

  // Получаем все уроки автора
  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      cover_image,
      created_at,
      course_id,
      courses (
        id,
        title
      )
    `)
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  // Группируем уроки: в курсах и без курса
  const lessonsInCourses = lessons?.filter(l => l.course_id) || []
  const lessonsWithoutCourse = lessons?.filter(l => !l.course_id) || []

  // Считаем бесплатные
  const freeLessons = lessons?.filter(l => l.is_free_preview) || []

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <Link href="/dashboard/mentor" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group mb-2">
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад в кабинет
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
              Мои уроки
            </h1>
            <p className="text-gray-600 mt-2">
              Управление учебными материалами и видео
            </p>
          </div>
          
          <Link
            href="/dashboard/mentor/lessons/new"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать урок
          </Link>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {lessons?.length || 0}
            </div>
            <div className="text-sm text-gray-600">
              Всего уроков
            </div>
          </div>
          
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {lessonsInCourses.length}
            </div>
            <div className="text-sm text-gray-600">
              В курсах
            </div>
          </div>
          
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {lessonsWithoutCourse.length}
            </div>
            <div className="text-sm text-gray-600">
              Отдельные
            </div>
          </div>
          
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {freeLessons.length}
            </div>
            <div className="text-sm text-gray-600">
              Бесплатных
            </div>
          </div>
        </div>
      </div>

      {/* Уроки в курсах */}
      {lessonsInCourses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
            Уроки в курсах ({lessonsInCourses.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonsInCourses.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                {/* Обложка */}
                <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  {lesson.cover_image ? (
                    <img 
                      src={lesson.cover_image} 
                      alt={lesson.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="opacity-50">🎥</span>
                  )}
                </div>

                {/* Информация */}
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {lesson.title}
                </h3>

                {lesson.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {lesson.description}
                  </p>
                )}

                {/* Курс */}
                {lesson.courses && lesson.courses.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 px-2.5 py-1.5 rounded-lg mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="font-medium truncate">
                      {lesson.courses[0].title}
                    </span>
                  </div>
                )}

                {/* Мета-информация */}
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
                    Редактировать
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Отдельные уроки (без курса) */}
      {lessonsWithoutCourse.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Отдельные уроки ({lessonsWithoutCourse.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonsWithoutCourse.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                {/* Обложка */}
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  {lesson.cover_image ? (
                    <img 
                      src={lesson.cover_image} 
                      alt={lesson.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="opacity-50">📄</span>
                  )}
                </div>

                {/* Информация */}
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {lesson.title}
                </h3>

                {lesson.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {lesson.description}
                  </p>
                )}

                {/* Мета-информация */}
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
                    Редактировать
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Если уроков нет */}
      {(!lessons || lessons.length === 0) && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Пока нет уроков
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Создайте свой первый урок, чтобы начать делиться знаниями с учениками
          </p>
          <Link
            href="/dashboard/mentor/lessons/new"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать урок
          </Link>
        </div>
      )}
    </main>
  )
}