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
      cover_image_url,
      created_at,
      coaches (
        id,
        display_name,
        specialization
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

  // Считаем количество уроков и получаем первого наставника
  const coursesWithCount = courses?.map(course => ({
    ...course,
    lessonsCount: course.lessons?.length || 0,
    coach: course.coaches?.[0] || null
  })) || []

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero секция */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Каталог курсов
          </h1>
          <p className="text-xl text-indigo-100">
            Найдите подходящий курс и начните обучение
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Статистика */}
        <div className="mb-8">
          <p className="text-gray-600">
            Найдено курсов: <span className="font-bold text-gray-900">{coursesWithCount.length}</span>
          </p>
        </div>

        {/* Список курсов */}
        {coursesWithCount.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coursesWithCount.map((course) => (
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
                  
                  {/* Цена на обложке */}
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

                  {/* Наставник */}
                  {course.coach && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {course.coach.display_name?.charAt(0).toUpperCase() || '👤'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {course.coach.display_name}
                        </p>
                        {course.coach.specialization && (
                          <p className="text-xs text-gray-500">
                            {course.coach.specialization}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Мета-информация */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>📚</span>
                      <span>
                        {course.lessonsCount} {course.lessonsCount === 1 ? 'урок' : course.lessonsCount < 5 ? 'урока' : 'уроков'}
                      </span>
                    </div>
                    
                    <div className="text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                      Подробнее →
                    </div>
                  </div>
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
            <p className="text-gray-600">
              Курсы будут добавлены в ближайшее время
            </p>
          </div>
        )}
      </div>
    </main>
  )
}