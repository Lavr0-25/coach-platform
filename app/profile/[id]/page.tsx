import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AchievementsBadge from '@/components/AchievementsBadge'

interface ProfilePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Получаем данные наставника
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select(`
      *,
      courses (
        id,
        title,
        price,
        cover_image_url
      ),
      lessons (
        id,
        title,
        price,
        is_free_preview
      )
    `)
    .eq('user_id', id)
    .single()

  if (coachError || !coach) {
    notFound()
  }

  const coursesCount = coach.courses?.length || 0
  const lessonsCount = coach.lessons?.length || 0

  // Получаем статистику достижений
  const { count: achievementsCount } = await supabase
    .from('user_achievements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', id)

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Кнопка назад */}
        <div className="mb-6">
          <Link href="/catalog" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад к каталогу
          </Link>
        </div>

        {/* Профиль */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="flex items-start gap-6 flex-col md:flex-row">
            {/* Аватар */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {(coach.display_name?.charAt(0).toUpperCase() || 'U')}
              </div>
            </div>

            {/* Информация */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {coach.display_name}
              </h1>
              
              {coach.specialization && (
                <p className="text-lg text-gray-600 mb-4">
                  {coach.specialization}
                </p>
              )}

              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-xl">📚</span>
                  <span className="font-medium">
                    {coursesCount} {coursesCount === 1 ? 'курс' : coursesCount < 5 ? 'курса' : 'курсов'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-xl">📖</span>
                  <span className="font-medium">
                    {lessonsCount} {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}
                  </span>
                </div>

                {achievementsCount && achievementsCount > 0 && (
                  <div className="flex items-center gap-2 text-gray-600 bg-yellow-100 px-4 py-2 rounded-lg">
                    <span className="text-xl">🏆</span>
                    <span className="font-medium">
                      {achievementsCount} {achievementsCount === 1 ? 'достижение' : achievementsCount < 5 ? 'достижения' : 'достижений'}
                    </span>
                  </div>
                )}
              </div>

              {coach.bio && (
                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <h3 className="font-semibold text-gray-900 mb-2">О себе</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {coach.bio}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Достижения */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <AchievementsBadge userId={id} />
        </div>

        {/* Курсы */}
        {coursesCount > 0 && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📚 Курсы наставника
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coach.courses?.map((course: any) => (
                <Link
                  key={course.id}
                  href={`/course/${course.id}`}
                  className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {course.title}
                  </h3>
                  <p className="text-blue-600 font-medium">
                    {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Уроки */}
        {lessonsCount > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📖 Отдельные уроки
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coach.lessons?.map((lesson: any) => (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {lesson.is_free_preview ? '🆓 Бесплатный превью' : lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {coursesCount === 0 && lessonsCount === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Пока нет материалов
            </h2>
            <p className="text-gray-600">
              Наставник пока не добавил курсы или уроки
            </p>
          </div>
        )}
      </div>
    </main>
  )
}