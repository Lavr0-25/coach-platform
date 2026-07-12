import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MessageButton from '@/components/MessageButton'
import ProfileFilters from '@/components/ProfileFilters'

export default async function ProfilePage({ params, searchParams }: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ search?: string; type?: 'all' | 'lessons' | 'courses'; sort?: 'newest' | 'oldest' | 'comments' | 'rating'; rating?: string }>
}) {
  const { id } = await params
  const { search: searchQuery, type: filterType = 'all', sort: sortBy = 'newest', rating: ratingFilter } = await searchParams
  const supabase = await createClient()

  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, display_name, specialization, bio, avatar_url, user_id')
    .eq('user_id', id)
    .in('role', ['mentor', 'admin'])
    .single()

  if (coachError || !coach) {
    notFound()
  }

  // Запрос уроков с отзывами и рейтингом
  let lessonsQuery = supabase
    .from('lessons')
    .select(`
      *,
      reviews (
        rating
      )
    `)
    .eq('coach_id', coach.id)
    .is('course_id', null)

  if (searchQuery) {
    lessonsQuery = lessonsQuery.ilike('title', `%${searchQuery}%`)
  }

  const { data: lessonsData } = await lessonsQuery

  // Запрос курсов с отзывами и рейтингом
  let coursesQuery = supabase
    .from('courses')
    .select(`
      *,
      reviews (
        rating
      )
    `)
    .eq('coach_id', coach.id)

  if (searchQuery) {
    coursesQuery = coursesQuery.ilike('title', `%${searchQuery}%`)
  }

  const { data: coursesData } = await coursesQuery

  // Обрабатываем уроки - считаем рейтинг и количество комментариев
  let lessons = lessonsData?.map((lesson: any) => {
    const reviews = lesson.reviews || []
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0'
    const reviewCount = reviews.length
    
    return {
      ...lesson,
      avgRating,
      reviewCount,
      commentsCount: 0
    }
  }) || []

  // Обрабатываем курсы
  let courses = coursesData?.map((course: any) => {
    const reviews = course.reviews || []
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0'
    const reviewCount = reviews.length
    
    return {
      ...course,
      avgRating,
      reviewCount,
      commentsCount: 0
    }
  }) || []

  // Фильтр по рейтингу
  if (ratingFilter) {
    const minRating = parseFloat(ratingFilter)
    lessons = lessons.filter((l: any) => parseFloat(l.avgRating) >= minRating)
    courses = courses.filter((c: any) => parseFloat(c.avgRating) >= minRating)
  }

  // Сортировка
  if (sortBy === 'newest') {
    lessons = lessons.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    courses = courses.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sortBy === 'oldest') {
    lessons = lessons.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    courses = courses.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  } else if (sortBy === 'rating') {
    lessons = lessons.sort((a: any, b: any) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
    courses = courses.sort((a: any, b: any) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
  } else if (sortBy === 'comments') {
    lessons = lessons.sort((a: any, b: any) => b.commentsCount - a.commentsCount)
    courses = courses.sort((a: any, b: any) => b.commentsCount - a.commentsCount)
  }

  // Фильтрация по типу
  let displayLessons = lessons
  let displayCourses = courses

  if (filterType === 'lessons') {
    displayCourses = []
  } else if (filterType === 'courses') {
    displayLessons = []
  }

  const totalLessons = lessons.length
  const totalCourses = courses.length

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Профиль - БЕЗ РЕЙТИНГА */}
        <div id="profile" className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {coach.avatar_url ? (
                <img src={coach.avatar_url} alt={coach.display_name || 'Ментор'} className="w-32 h-32 rounded-full object-cover border-4 border-blue-100" />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {coach.display_name?.charAt(0).toUpperCase() || 'M'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{coach.display_name}</h1>
              {coach.specialization && <p className="text-lg text-gray-600 mb-3">{coach.specialization}</p>}
              <div className="flex gap-6 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalLessons}</div>
                  <div className="text-sm text-gray-600">уроков</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{totalCourses}</div>
                  <div className="text-sm text-gray-600">курсов</div>
                </div>
              </div>
              <MessageButton coachId={coach.user_id} coachName={coach.display_name || ''} />
            </div>
          </div>
          {coach.bio && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Обо мне</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
            </div>
          )}
        </div>

       {/* Поиск и фильтры */}
<div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
  <form className="space-y-4">
    <div className="relative">
      <input
        type="text"
        name="search"
        defaultValue={searchQuery}
        placeholder="Поиск по названию..."
        className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {searchQuery && (
        <Link 
          href={`/profile/${id}`}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </Link>
      )}
    </div>
    
    {/* Client Component для фильтров */}
    <ProfileFilters
      profileId={id}
      filterType={filterType}
      sortBy={sortBy}
      ratingFilter={ratingFilter || ''}
      searchQuery={searchQuery}
      totalLessons={totalLessons}
      totalCourses={totalCourses}
    />
  </form>
</div>

        {/* Уроки */}
        {filterType !== 'courses' && displayLessons && displayLessons.length > 0 && (
          <div id="lessons" className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🎬 Уроки</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayLessons.map((lesson: any) => (
                <Link 
                  key={lesson.id} 
                  href={`/lesson/${lesson.id}`} 
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">🎬</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{lesson.title}</h3>
                      <p className="text-sm text-gray-600">{coach.display_name}</p>
                    </div>
                  </div>
                  {lesson.description && <p className="text-sm text-gray-700 mb-3 line-clamp-2">{lesson.description}</p>}
                  
                  {/* Рейтинг и отзывы */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 font-bold">{lesson.avgRating}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < Math.round(parseFloat(lesson.avgRating)) ? 'text-yellow-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">({lesson.reviewCount})</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {lesson.price === 0 || lesson.is_free_preview ? (
                      <span className="text-green-600 font-medium text-sm">Бесплатно</span>
                    ) : (
                      <span className="text-purple-600 font-medium text-sm">{lesson.price} руб.</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Курсы */}
        {filterType !== 'lessons' && displayCourses && displayCourses.length > 0 && (
          <div id="courses" className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6"> Курсы</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayCourses.map((course: any) => (
                <div 
                  key={course.id} 
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">📚</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{course.title}</h3>
                      <p className="text-sm text-gray-600">{coach.display_name}</p>
                    </div>
                  </div>
                  {course.description && <p className="text-sm text-gray-700 mb-3 line-clamp-2">{course.description}</p>}
                  
                  {/* Рейтинг и отзывы */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 font-bold">{course.avgRating}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < Math.round(parseFloat(course.avgRating)) ? 'text-yellow-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">({course.reviewCount})</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {course.price === 0 ? (
                      <span className="text-green-600 font-medium text-sm">Бесплатно</span>
                    ) : (
                      <span className="text-purple-600 font-medium text-sm">{course.price} руб.</span>
                    )}
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                      Смотреть
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Нет результатов */}
        {(filterType === 'lessons' && (!displayLessons || displayLessons.length === 0)) ||
         (filterType === 'courses' && (!displayCourses || displayCourses.length === 0)) ||
         (filterType === 'all' && (!displayLessons || displayLessons.length === 0) && (!displayCourses || displayCourses.length === 0)) ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <p className="text-gray-600">
              {searchQuery ? 'Ничего не найдено' : 'У этого ментора пока нет контента'}
            </p>
          </div>
        ) : null}

        {/* Навигация */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-2">
          <a 
            href="#lessons"
            className="bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow border"
            title="К урокам"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253m19 0c-1.168-.776-2.754-1.253-4.5-1.253s-3.332.477-4.5 1.253M12 6.253c1.168-.776 2.754-1.253 4.5-1.253s3.332.477 4.5 1.253" />
            </svg>
          </a>
          <a 
            href="#profile"
            className="bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow border"
            title="Наверх"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  )
}