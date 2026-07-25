import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RemoveFavoriteButton from '@/components/RemoveFavoriteButton'

export default async function FavoritesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Получаем все записи избранного пользователя
  const { data: favorites } = await supabase
    .from('favorites')
    .select('id, lesson_id, group_name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const lessonIds = favorites?.map(f => f.lesson_id) || []

  let favLessons: any[] = []

  // Получаем данные уроков
  if (lessonIds.length > 0) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select(`
        id, 
        title, 
        description, 
        price, 
        cover_image, 
        is_free_preview, 
        coach_id,
        coaches(display_name, avatar_url)
      `)
      .in('id', lessonIds)
    
    favLessons = lessons?.map(l => ({
      ...l,
      favorited_at: favorites?.find(f => f.lesson_id === l.id)?.created_at
    })) || []
  }

  // Сортируем по дате добавления в избранное (новые сверху)
  favLessons.sort((a, b) => new Date(b.favorited_at).getTime() - new Date(a.favorited_at).getTime())

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:text-purple-600 transition-colors">Главная</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Избранное</span>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
          Избранное
        </h1>
        <p className="text-gray-600">
          {favLessons.length > 0 
            ? `Вы сохранили ${favLessons.length} ${favLessons.length === 1 ? 'урок' : favLessons.length < 5 ? 'урока' : 'уроков'}`
            : 'Здесь будут отображаться сохраненные уроки'
          }
        </p>
      </div>

      {/* Если пусто */}
      {favLessons.length === 0 && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">💜</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Список избранного пуст</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Нажимайте на сердечко на карточках уроков, чтобы сохранять их здесь
          </p>
          <Link
            href="/mentors"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
          >
            Найти авторов и материалы
          </Link>
        </div>
      )}

      {/* Избранные уроки */}
      {favLessons.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📝</span>
            Мои избранные уроки ({favLessons.length})
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favLessons.map((lesson) => (
              <div key={lesson.id} className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100 relative">
                <RemoveFavoriteButton itemId={lesson.id} />
                
                <Link href={`/lesson/${lesson.id}`} className="block">
                  <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                    {lesson.cover_image ? (
                      <img src={lesson.cover_image} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="opacity-50">📝</span>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {lesson.title}
                  </h3>
                  
                  {lesson.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{lesson.description}</p>
                  )}

                  {/* Автор */}
                  {lesson.coaches && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      {lesson.coaches.avatar_url ? (
                        <img src={lesson.coaches.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-purple-200 flex items-center justify-center text-[10px] text-purple-700 font-bold">
                          {lesson.coaches.display_name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{lesson.coaches.display_name}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                    <div className="flex items-center gap-2">
                      {lesson.is_free_preview ? (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">Бесплатно</span>
                      ) : (
                        <span className="text-sm font-bold text-purple-700">{lesson.price} ₽</span>
                      )}
                    </div>
                    <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Перейти
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}