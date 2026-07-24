import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function MentorsPage() {
  const supabase = await createClient()

  // Получаем всех менторов
  const { data: coaches } = await supabase
    .from('coaches')
    .select(`
      id,
      display_name,
      avatar_url,
      specialization,
      bio,
      user_id
    `)
    .eq('role', 'mentor')
    .order('display_name', { ascending: true })

  // Для каждого ментора считаем количество курсов и уроков
  const coachesWithStats = await Promise.all(
    (coaches || []).map(async (coach) => {
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coach.id)
        .eq('is_published', true)

      const { count: lessonsCount } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coach.id)

      return {
        ...coach,
        coursesCount: coursesCount || 0,
        lessonsCount: lessonsCount || 0,
      }
    })
  )

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group mb-2">
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              На главную
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
              Наши авторы
            </h1>
            <p className="text-gray-600 mt-2">
              Познакомьтесь с экспертами платформы и выберите подходящего наставника
            </p>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 px-4 py-2 rounded-xl">
            <span className="text-sm text-gray-600">
              Всего авторов: <span className="font-bold text-purple-700">{coachesWithStats.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Список менторов */}
      {coachesWithStats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coachesWithStats.map((coach) => (
            <Link
              key={coach.id}
              href={`/mentor/${coach.id}`}
              className="style-card p-6 hover:shadow-lg transition-all group border border-purple-100 flex flex-col"
            >
              {/* Аватар и имя */}
              <div className="flex items-start gap-4 mb-4">
                {coach.avatar_url ? (
                  <img
                    src={coach.avatar_url}
                    alt={coach.display_name || ''}
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 gradient-icon rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                    {coach.display_name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                    {coach.display_name || 'Автор'}
                  </h3>
                  {coach.specialization && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {coach.specialization}
                    </p>
                  )}
                </div>
              </div>

              {/* Биография */}
              {coach.bio && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-1">
                  {coach.bio}
                </p>
              )}

              {/* Статистика */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-purple-100">
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text">
                    {coach.coursesCount}
                  </div>
                  <div className="text-xs text-gray-500">
                    {coach.coursesCount === 1 ? 'курс' : coach.coursesCount < 5 ? 'курса' : 'курсов'}
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text">
                    {coach.lessonsCount}
                  </div>
                  <div className="text-xs text-gray-500">
                    {coach.lessonsCount === 1 ? 'урок' : coach.lessonsCount < 5 ? 'урока' : 'уроков'}
                  </div>
                </div>
              </div>

              {/* Кнопка */}
              <div className="mt-4 pt-4 border-t border-purple-100">
                <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center justify-center gap-1">
                  Посмотреть профиль
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Пока нет авторов
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Станьте первым автором на платформе и начните делиться своими знаниями с учениками
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