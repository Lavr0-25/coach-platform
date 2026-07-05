import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  // Получаем курсы наставника (включая черновики)
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
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor" className="hover:text-blue-600">
          Кабинет наставника
        </Link>
        <span>/</span>
        <span className="text-gray-900">Мои курсы</span>
      </div>

      {/* Заголовок и кнопка */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Мои курсы
          </h1>
          <p className="text-gray-600">
            Управление учебными программами
          </p>
        </div>
        <Link
          href="/dashboard/mentor/courses/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать курс
        </Link>
      </div>

      {/* Список курсов */}
      {coursesWithCount.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coursesWithCount.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/mentor/courses/${course.id}/edit`}
              className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md hover:border-blue-300 transition-all group"
            >
              {/* Обложка или заглушка */}
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                {course.cover_image_url ? (
                  <img 
                    src={course.cover_image_url} 
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>📚</span>
                )}
              </div>

              {/* Информация */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                {course.title}
              </h3>

              {course.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {course.description}
                </p>
              )}

              {/* Мета-информация */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>📚</span>
                  <span>{course.lessonsCount} {course.lessonsCount === 1 ? 'урок' : course.lessonsCount < 5 ? 'урока' : 'уроков'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {course.is_published ? (
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                      Опубликован
                    </span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
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
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Пока нет курсов
          </h2>
          <p className="text-gray-600 mb-6">
            Создайте свой первый курс, чтобы объединить уроки в учебную программу
          </p>
          <Link
            href="/dashboard/mentor/courses/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать курс
          </Link>
        </div>
      )}
    </main>
  )
}