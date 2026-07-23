import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Ленивая загрузка тяжёлых компонентов
const ReviewsSection = dynamic(
  () => import('@/components/CourseReviews'),
  { 
    loading: () => (
      <div className="style-card p-6 animate-pulse space-y-4">
        <div className="h-8 bg-purple-100 rounded w-1/4"></div>
        <div className="h-24 bg-purple-100 rounded"></div>
      </div>
    )
  }
)

const CourseComments = dynamic(
  () => import('@/components/LessonComments'),
  { 
    loading: () => (
      <div className="style-card p-6 animate-pulse space-y-4">
        <div className="h-8 bg-purple-100 rounded w-1/4"></div>
        <div className="h-32 bg-purple-100 rounded"></div>
      </div>
    )
  }
)

interface CoursePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params
  
  const supabase = await createClient()

  // Отслеживаем просмотр курса
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'course_view',
        user_id: user.id,
        target_id: id,
        target_type: 'course',
      })
  }

  // Получаем данные курса
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(`
      *,
      coaches (
        id,
        display_name,
        specialization,
        avatar_url
      )
    `)
    .eq('id', id)
    .single()

  if (courseError || !course) {
    notFound()
  }

  const coach = Array.isArray(course.coaches) ? course.coaches[0] : course.coaches

  // Получаем модули курса с уроками
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(`
      id,
      title,
      order_index,
      lessons (
        id,
        title,
        description,
        price,
        is_free_preview,
        order_index,
        duration,
        lesson_content (
          id,
          content_type,
          content_url,
          order_index
        )
      )
    `)
    .eq('course_id', id)
    .order('order_index', { ascending: true })

  if (modulesError) {
    console.error('Modules error:', modulesError)
  }

  // Сортируем уроки внутри модулей
  const sortedModules = modules?.map(module => ({
    ...module,
    lessons: (module.lessons || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
  })) || []

  // Если модулей нет, получаем уроки напрямую из курса
  let directLessons: any[] = []
  if (sortedModules.length === 0) {
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        price,
        is_free_preview,
        order_index,
        duration,
        lesson_content (
          id,
          content_type,
          content_url,
          order_index
        )
      `)
      .eq('course_id', id)
      .order('order_index', { ascending: true })
    
    if (lessonsData) {
      directLessons = lessonsData
    }
  }

  // Подсчитываем общее количество уроков и длительность
  const totalLessons = sortedModules.length > 0 
    ? sortedModules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0)
    : directLessons.length
  
  
  const totalDuration = sortedModules.length > 0
    ? sortedModules.reduce((sum, m) => 
        sum + (m.lessons?.reduce((s: number, l: any) => s + (l.duration || 0), 0) || 0), 0
      )
    : directLessons.reduce((sum, l) => sum + (l.duration || 0), 0)

  const isFree = course.price === 0 || course.is_free_preview

  // Проверяем, куплен ли курс пользователем
  let isPurchased = false
  if (user) {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', id)
      .eq('payment_status', 'completed')
      .single()
    
    isPurchased = !!purchase
  }

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return null
    if (minutes < 60) return `${minutes} мин`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
  }

  const getLessonsWord = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'урок'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'урока'
    return 'уроков'
  }

  const getContentTypeIcon = (contentType: string | null) => {
    const icons: Record<string, string> = {
      video: '🎥',
      youtube: '🎥',
      vk_video: '🎥',
      pdf: '📄',
      image: '️',
      storage: '📁',
      other: '🔗',
    }
    return icons[contentType || ''] || '📄'
  }

  // Получаем первый урок для кнопки "Начать обучение"
  const firstLessonId = sortedModules.length > 0 
    ? sortedModules[0]?.lessons?.[0]?.id 
    : directLessons[0]?.id

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pt-24 sm:pt-28">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>
      </div>

      {/* Заголовок курса с обложкой */}
      <div className="style-card p-6 sm:p-8 mb-6">
        {/* Обложка курса */}
        {course.cover_image ? (
          <div className="mb-6">
            <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
              <img
                src={course.cover_image}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="aspect-video gradient-icon rounded-xl flex items-center justify-center">
              <div className="text-8xl opacity-50">🎓</div>
            </div>
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-4 leading-tight">
          {course.title}
        </h1>
        
        {coach && (
          <div className="mb-5">
            <Link 
              href={`/mentor/${coach.id}`}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors group"
            >
              {coach.avatar_url ? (
                <img src={coach.avatar_url} alt={coach.display_name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 gradient-icon rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {coach.display_name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
              <span className="font-semibold">{coach.display_name}</span>
              {coach.specialization && (
                <span className="text-gray-400">• {coach.specialization}</span>
              )}
            </Link>
          </div>
        )}

        {/* Статистика курса */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {isFree ? (
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-md shadow-green-500/20">
              Бесплатно
            </span>
          ) : (
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-md shadow-purple-500/20">
              {course.price} ₽
            </span>
          )}
          
          <span className="text-sm text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {totalLessons} {getLessonsWord(totalLessons)}
          </span>
          
          {totalDuration > 0 && (
            <span className="text-sm text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(totalDuration)}
            </span>
          )}
          
          <span className="text-sm text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(course.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-wrap gap-3">
          {isPurchased || isFree ? (
            <Link
              href={firstLessonId ? `/lesson/${firstLessonId}` : '#'}
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isPurchased ? 'Продолжить обучение' : 'Начать обучение'}
            </Link>
          ) : (
            <Link
              href={`/checkout?course_id=${id}`}
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Купить курс
            </Link>
          )}
          
          <button className="bg-white text-purple-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            В избранное
          </button>
        </div>
      </div>

      {/* Программа курса с модулями */}
      {sortedModules.length > 0 && (
        <div className="style-card p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            Программа курса
          </h2>
          
          <div className="space-y-6">
            {sortedModules.map((module, moduleIndex) => (
              <div key={module.id} className="border border-purple-100 rounded-xl overflow-hidden">
                {/* Заголовок модуля */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-4 border-b border-purple-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-7 h-7 gradient-icon rounded-lg flex items-center justify-center text-white text-sm">
                      {moduleIndex + 1}
                    </span>
                    {module.title || `Модуль ${moduleIndex + 1}`}
                    <span className="text-sm text-gray-500 font-normal ml-2">
                      • {module.lessons?.length || 0} {getLessonsWord(module.lessons?.length || 0)}
                    </span>
                  </h3>
                </div>
                
                {/* Список уроков */}
                <div className="divide-y divide-purple-50">
                  {module.lessons?.map((lesson: any, lessonIndex: number) => {
                    const hasContent = lesson.lesson_content && lesson.lesson_content.length > 0
                    const contentType = hasContent ? lesson.lesson_content[0].content_type : null
                    const icon = getContentTypeIcon(contentType)
                    
                    return (
                      <Link
                        key={lesson.id}
                        href={`/lesson/${lesson.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-purple-50/50 transition-colors group"
                      >
                        <div className="w-10 h-10 flex-shrink-0 bg-purple-100 rounded-lg flex items-center justify-center text-lg group-hover:bg-purple-200 transition-colors">
                          {icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                            {lessonIndex + 1}. {lesson.title}
                          </h4>
                          {lesson.description && (
                            <p className="text-sm text-gray-500 truncate mt-0.5">
                              {lesson.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {lesson.is_free_preview && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              Бесплатно
                            </span>
                          )}
                          {lesson.duration > 0 && (
                            <span className="text-xs text-gray-500">
                              {formatDuration(lesson.duration)}
                            </span>
                          )}
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Программа курса без модулей (уроки напрямую) */}
      {sortedModules.length === 0 && directLessons.length > 0 && (
        <div className="style-card p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            Программа курса
          </h2>
          
          <div className="space-y-3">
            {directLessons.map((lesson: any, index: number) => {
              const hasContent = lesson.lesson_content && lesson.lesson_content.length > 0
              const contentType = hasContent ? lesson.lesson_content[0].content_type : null
              const icon = getContentTypeIcon(contentType)
              
              return (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="flex items-center gap-4 p-4 bg-purple-50/30 rounded-xl hover:bg-purple-50 transition-colors group border border-purple-100"
                >
                  <div className="w-10 h-10 flex-shrink-0 bg-purple-100 rounded-lg flex items-center justify-center text-lg group-hover:bg-purple-200 transition-colors">
                    {icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                      {index + 1}. {lesson.title}
                    </h4>
                    {lesson.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {lesson.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lesson.is_free_preview && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Бесплатно
                      </span>
                    )}
                    {lesson.duration > 0 && (
                      <span className="text-xs text-gray-500">
                        {formatDuration(lesson.duration)}
                      </span>
                    )}
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Описание */}
      {course.description && (
        <div className="style-card p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Описание курса
          </h2>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base sm:text-lg">
            {course.description}
          </div>
        </div>
      )}

      {/* Отзывы */}
      <div className="mb-6 sm:mb-8">
        <ReviewsSection courseId={id} />
      </div>

      {/* Комментарии */}
      <div className="mb-6 sm:mb-8">
        <CourseComments lessonId={id} />
      </div>
    </main>
  )
}