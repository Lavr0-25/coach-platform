import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CoursesCatalogPage() {
  const supabase = await createClient()

  // Получаем все опубликованные курсы
  const { data: courses, error } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      description,
      price,
      cover_image,
      cover_image_url,
      created_at,
      coaches (
        id,
        display_name,
        specialization,
        avatar_url
      ),
      lessons (
        id
      )
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading courses:', error)
  }

  // Считаем количество уроков и получаем первого автора
  const coursesWithCount = courses?.map(course => ({
    ...course,
    cover_image: course.cover_image || course.cover_image_url,
    lessonsCount: course.lessons?.length || 0,
    coach: course.coaches?.[0] || null
  })) || []

  const getLessonsWord = (count: number) => {
    if (count === 0) return 'уроков'
    if (count % 10 === 1 && count % 100 !== 11) return 'урок'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'урока'
    return 'уроков'
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Заголовок и навигация */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group mb-2">
            <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            На главную
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
            Каталог курсов
          </h1>
          <p className="text-gray-600 mt-2">
            Найдите подходящий курс и начните обучение у лучших авторов
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 px-4 py-2 rounded-xl">
          <span className="text-sm text-gray-600">
            Найдено курсов: <span className="font-bold text-purple-700">{coursesWithCount.length}</span>
          </span>
        </div>
      </div>

      {/* Список курсов */}
      {coursesWithCount.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coursesWithCount.map((course) => (
            <Link
              key={course.id}
              href={`/course/${course.id}`}
              className="style-card overflow-hidden hover:shadow-lg transition-all group border border-purple-100 flex flex-col"
            >
              {/* Обложка */}
              <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 relative overflow-hidden">
                {course.cover_image ? (
                  <img 
                    src={course.cover_image} 
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-6xl opacity-50">
                    🎓
                  </div>
                )}
                
                {/* Цена на обложке */}
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                </div>
              </div>

              {/* Информация */}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-purple-600 transition-colors text-base">
                  {course.title}
                </h3>

                {course.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                    {course.description}
                  </p>
                )}

                {/* Автор */}
                {course.coach && (
                  <div className="flex items-center gap-2 mb-4 pt-4 border-t border-purple-100">
                    {course.coach.avatar_url ? (
                      <img 
                        src={course.coach.avatar_url} 
                        alt={course.coach.display_name} 
                        className="w-8 h-8 rounded-full object-cover border border-purple-200"
                      />
                    ) : (
                      <div className="w-8 h-8 gradient-icon rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {course.coach.display_name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {course.coach.display_name}
                      </p>
                      {course.coach.specialization && (
                        <p className="text-xs text-gray-500 truncate">
                          {course.coach.specialization}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Мета-информация */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>
                      {course.lessonsCount} {getLessonsWord(course.lessonsCount)}
                    </span>
                  </div>
                  
                  <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Подробнее
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
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
          <p className="text-gray-600 max-w-md mx-auto">
            Авторы пока не опубликовали ни одного курса. Загляните позже или станьте первым автором!
          </p>
          <Link
            href="/dashboard/mentor"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-block mt-6"
          >
            Стать автором
          </Link>
        </div>
      )}
    </main>
  )
}