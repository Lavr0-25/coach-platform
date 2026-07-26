import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface ProfilePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Получаем данные ментора
  const { data: coach, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('user_id', id)
    .single()

  if (error || !coach) {
    notFound()
  }

  // Получаем курсы ментора
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, cover_image, price, is_free')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  // Получаем уроки ментора
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, description, cover_image, price, is_free')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  const hasContent = (courses && courses.length > 0) || (lessons && lessons.length > 0)

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pt-24 sm:pt-28">
      {/* Назад */}
      <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 mb-6 transition-colors group">
        <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        На главную
      </Link>

      {/* Карточка профиля */}
      <div className="style-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
            {coach.avatar_url ? (
              <img 
                src={coach.avatar_url} 
                alt={coach.display_name || 'Аватар'} 
                className="w-full h-full rounded-full object-cover border-4 border-purple-100 shadow-lg"
              />
            ) : (
              <div className="w-full h-full gradient-icon rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {coach.display_name?.charAt(0).toUpperCase() || 'A'}
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {coach.display_name || 'Автор'}
            </h1>
            {coach.specialization && (
              <p className="text-purple-600 font-medium text-lg mb-3">
                {coach.specialization}
              </p>
            )}
            {coach.bio && (
              <p className="text-gray-600 leading-relaxed max-w-2xl">
                {coach.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Контент */}
      {hasContent ? (
        <div className="space-y-8">
          {/* Курсы */}
          {courses && courses.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                  📚
                </span>
                Курсы ({courses.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => (
                  <Link 
                    key={course.id} 
                    href={`/course/${course.id}`}
                    className="style-card p-4 hover:shadow-md transition-all group"
                  >
                    {course.cover_image ? (
                      <div className="aspect-video rounded-xl overflow-hidden mb-3 bg-gray-100">
                        <img src={course.cover_image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl mb-3 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                        <span className="text-4xl">📚</span>
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors mb-2">
                      {course.title}
                    </h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className={course.is_free || course.price === 0 ? 'text-green-600 font-semibold' : 'text-purple-600 font-semibold'}>
                        {course.is_free || course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Уроки */}
          {lessons && lessons.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                  🎬
                </span>
                Уроки ({lessons.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lessons.map((lesson) => (
                  <Link 
                    key={lesson.id} 
                    href={`/lesson/${lesson.id}`}
                    className="style-card p-4 hover:shadow-md transition-all group"
                  >
                    {lesson.cover_image ? (
                      <div className="aspect-video rounded-xl overflow-hidden mb-3 bg-gray-100">
                        <img src={lesson.cover_image} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl mb-3 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                        <span className="text-4xl">🎬</span>
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors mb-2">
                      {lesson.title}
                    </h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className={lesson.is_free || lesson.price === 0 ? 'text-green-600 font-semibold' : 'text-purple-600 font-semibold'}>
                        {lesson.is_free || lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Пока нет опубликованных материалов
          </h3>
          <p className="text-gray-500">
            Этот автор ещё не добавил курсы или уроки.
          </p>
        </div>
      )}
    </main>
  )
}