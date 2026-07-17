import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MentorDashboardClient from './MentorDashboardClient'

export default async function MentorDashboard() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }

  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, display_name, role, avatar_url')
    .eq('user_id', user.id)
    .single()

  if (coachError) {
    console.error('Error fetching coach:', coachError)
  }

  if (!coach || (coach.role !== 'mentor' && coach.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="style-card p-8 max-w-md text-center w-full">
          <div className="w-20 h-20 gradient-icon rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold gradient-text mb-3">
            Требуется активация
          </h1>
          <p className="text-gray-600 mb-8">
            {!coach 
              ? 'У вас ещё нет записи в системе авторов. Нажмите кнопку ниже, чтобы стать автором.'
              : 'Ваша учётная запись ещё не активирована как автор.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/"
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all text-center"
            >
              Стать автором
            </a>
            <Link
              href="/"
              className="bg-white text-gray-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all text-center"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const coachData = coach

  // Безопасные запросы с обработкой ошибок
  let myLessons: any[] = []
  let favorites: any[] = []
  let inProgress: any[] = []
  let completed: any[] = []
  let purchases: any[] = []

  try {
    // Загружаем уроки с информацией о курсах
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select(`
        id, 
        title, 
        created_at, 
        price, 
        is_free_preview,
        course_id,
        module_id
      `)
      .eq('coach_id', coachData.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (lessonsData) {
      // Для каждого урока находим курсы, в которые он входит
      const lessonsWithCourses = await Promise.all(
        lessonsData.map(async (lesson) => {
          // Если урок привязан к модулю, находим курс через модуль
          if (lesson.module_id) {
            const { data: moduleData } = await supabase
              .from('modules')
              .select('course_id, courses(title)')
              .eq('id', lesson.module_id)
              .single()
            
            if (moduleData && moduleData.courses) {
              return {
                ...lesson,
                courses: [moduleData.courses]
              }
            }
          }
          
          // Если урок привязан напрямую к курсу
          if (lesson.course_id) {
            const { data: courseData } = await supabase
              .from('courses')
              .select('id, title')
              .eq('id', lesson.course_id)
              .single()
            
            if (courseData) {
              return {
                ...lesson,
                courses: [courseData]
              }
            }
          }
          
          // Урок не входит ни в какой курс
          return {
            ...lesson,
            courses: []
          }
        })
      )
      
      myLessons = lessonsWithCourses
    }
  } catch (error) {
    console.error('Error fetching lessons:', error)
  }

  try {
    const { data: favoritesData } = await supabase
      .from('favorites')
      .select(`
        id,
        group_name,
        lessons (
          id,
          title,
          description
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (favoritesData) favorites = favoritesData
  } catch (error) {
    console.error('Error fetching favorites:', error)
  }

  try {
    const { data: inProgressData } = await supabase
      .from('learning_progress')
      .select(`
        id,
        progress_percentage,
        last_watched_at,
        lessons (
          id,
          title,
          description
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('last_watched_at', { ascending: false })
      .limit(20)
    
    if (inProgressData) inProgress = inProgressData
  } catch (error) {
    console.error('Error fetching in progress:', error)
  }

  try {
    const { data: completedData } = await supabase
      .from('learning_progress')
      .select(`
        id,
        progress_percentage,
        last_watched_at,
        lessons (
          id,
          title,
          description
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('last_watched_at', { ascending: false })
      .limit(20)
    
    if (completedData) completed = completedData
  } catch (error) {
    console.error('Error fetching completed:', error)
  }

  try {
    const { data: purchasesData } = await supabase
      .from('purchases')
      .select(`
        id,
        purchased_at,
        amount,
        lessons (
          id,
          title,
          description
        )
      `)
      .eq('user_id', user.id)
      .eq('payment_status', 'completed')
      .order('purchased_at', { ascending: false })
      .limit(20)
    
    if (purchasesData) purchases = purchasesData
  } catch (error) {
    console.error('Error fetching purchases:', error)
  }

  const getInitials = (name?: string | null) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Приветствие и Аватар */}
      <div className="style-card p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Аватар */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center flex-shrink-0">
            {coachData.avatar_url ? (
              <img 
                src={coachData.avatar_url} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-purple-600">
                {getInitials(coachData.display_name)}
              </span>
            )}
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">
              Добро пожаловать{coachData.display_name ? `, ${coachData.display_name}` : ''}! 👋
            </h1>
            <p className="text-gray-600 mb-4">
              Управляйте своими уроками, следите за прогрессом и учитесь у других авторов
            </p>
            
            <div className="flex flex-wrap justify-center sm:justify-start gap-3">
              <Link
                href="/dashboard/mentor/lessons/new"
                className="gradient-btn text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Создать урок
              </Link>
              
              <Link
                href="/mentor/analytics"
                className="bg-white text-purple-700 border border-purple-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-50 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Статистика
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Клиентский компонент с вкладками */}
      <MentorDashboardClient
        coachId={coachData.id}
        myLessons={myLessons}
        favorites={favorites}
        inProgress={inProgress}
        completed={completed}
        purchases={purchases}
      />
    </main>
  )
}