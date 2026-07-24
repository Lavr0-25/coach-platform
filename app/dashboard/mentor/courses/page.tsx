import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createCourse } from '@/app/actions/createCourse'

export default async function MentorCoursesPage() {
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

  // Получаем курсы автора (включая черновики)
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      description,
      price,
      is_published,
      cover_image_url,
      cover_image,
      created_at,
      lessons (
        id,
        title
      )
    `)
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  // Считаем количество уроков в каждом курсе
  const coursesWithCount = courses?.map(course => ({
    ...course,
    lessonsCount: course.lessons?.length || 0
  })) || []

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor" className="hover:text-purple-600 transition-colors">
          Кабинет автора
        </Link>
        <span>/</span>
        <span className="text-gray-900">Мои курсы</span>
      </div>

      {/* Заголовок и кнопка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Мои курсы
          </h1>
          <p className="text-gray-600">
            Управление учебными программами
          </p>
        </div>
        <form action={createCourse}>
          <button
            type="submit"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать курс
          </button>
        </form>
      </div>

      {/* Список курсов */}
      {coursesWithCount.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coursesWithCount.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/mentor/courses/${course.id}/edit`}
              className="style-card p-6 hover:shadow-md transition-all group border border-purple-100"
            >
              {/* Обложка или заглушка */}
              <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                {course.cover_image_url || course.cover_image ? (
                  <img 
                    src={course.cover_image_url || course.cover_image} 
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="opacity-50">📚</span>
                )}
              </div>

              {/* Информация */}
              <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                {course.title}
              </h3>

              {course.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {course.description}
                </p>
              )}

              {/* Мета-информация */}
              <div className="flex items-center justify-between pt-4 border-t border-purple-100">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>{course.lessonsCount} {course.lessonsCount === 1 ? 'урок' : course.lessonsCount < 5 ? 'урока' : 'уроков'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {course.is_published ? (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      Опубликован
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      Черновик
                    </span>
                  )}
                </div>
              </div>

              {/* Цена */}
              <div className="mt-3 text-lg font-bold text-gray-900">
                {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Пока нет курсов
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Создайте свой первый курс, чтобы объединить уроки в учебную программу
          </p>
          <form action={createCourse}>
            <button
              type="submit"
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать курс
            </button>
          </form>
        </div>
      )}
    </main>
  )
}