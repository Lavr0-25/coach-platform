import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function FavoritesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: favorites, error } = await supabase
    .from('favorites')
    .select(`
      id,
      group_name,
      created_at,
      lessons (
        id,
        title,
        description,
        price,
        is_free_preview,
        coaches (
          id,
          display_name
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading favorites:', error)
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ⭐ Избранное
          </h1>
          <p className="text-gray-600 text-lg">
            Уроки, которые вы сохранили для дальнейшего изучения
          </p>
        </div>

        {favorites && favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const lesson = favorite.lessons
              if (!lesson) return null

              return (
                <Link
                  key={favorite.id}
                  href={`/lesson/${lesson.id}`}
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <div className="mb-3">
                    {favorite.group_name && (
                      <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded mb-2">
                        {favorite.group_name}
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {lesson.title}
                    </h3>
                    {lesson.coaches && (
                      <p className="text-sm text-gray-600 mb-2">
                        👨‍🏫 {lesson.coaches.display_name}
                      </p>
                    )}
                  </div>

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
                      {new Date(favorite.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">⭐</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Пока нет избранных уроков
            </h2>
            <p className="text-gray-600 mb-6">
              Добавьте уроки в избранное, чтобы быстро найти их позже
            </p>
            <Link
              href="/catalog"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Перейти в каталог
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}