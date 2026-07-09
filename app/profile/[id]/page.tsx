import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, display_name, specialization, bio, avatar_url, created_at')
    .eq('user_id', id)
    .in('role', ['mentor', 'admin'])
    .single()

  if (coachError || !coach) {
    notFound()
  }

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  const totalLessons = lessons?.length || 0
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('coach_id', coach.id)

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0'

  const totalReviews = reviews?.length || 0
  const fullStars = Math.round(parseFloat(avgRating))

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {coach.avatar_url ? (
                <img
                  src={coach.avatar_url}
                  alt={coach.display_name || 'Ментор'}
                  className="w-32 h-32 rounded-full object-cover border-4 border-blue-100"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {coach.display_name?.charAt(0).toUpperCase() || 'M'}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {coach.display_name}
              </h1>
              
              {coach.specialization && (
                <p className="text-lg text-gray-600 mb-3">
                  {coach.specialization}
                </p>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-yellow-500">
                    {avgRating}
                  </span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < fullStars ? 'text-yellow-500' : 'text-gray-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-gray-600">
                    ({totalReviews} {totalReviews === 1 ? 'отзыв' : totalReviews < 5 ? 'отзыва' : 'отзывов'})
                  </span>
                </div>
              </div>

              <div className="flex gap-6 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {totalLessons}
                  </div>
                  <div className="text-sm text-gray-600">уроков</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {totalReviews}
                  </div>
                  <div className="text-sm text-gray-600">отзывов</div>
                </div>
              </div>

              <button
                onClick={() => alert('Функция сообщений скоро будет доступна!')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                ✉️ Написать сообщение
              </button>
            </div>
          </div>

          {coach.bio && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Обо мне
              </h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {coach.bio}
              </p>
            </div>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📚 Уроки и курсы
          </h2>
          
          {lessons && lessons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {lesson.title}
                  </h3>
                  
                  {lesson.description && (
                    <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                      {lesson.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    {lesson.price === 0 || lesson.is_free_preview ? (
                      <span className="text-green-600 font-medium text-sm">
                        🆓 Бесплатно
                      </span>
                    ) : (
                      <span className="text-purple-600 font-medium text-sm">
                        💰 {lesson.price} ₽
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <div className="text-6xl mb-4"></div>
              <p className="text-gray-600">
                У этого ментора пока нет уроков
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}