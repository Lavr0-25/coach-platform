import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MentorDashboardClient from './MentorDashboardClient'

export default async function MentorDashboard() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Проверяем, есть ли запись в coaches с ролью mentor или admin
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name, role')
    .eq('user_id', user.id)
    .single()

  // Если нет записи в coaches или роль не mentor/admin — показываем сообщение
  if (!coach || (coach.role !== 'mentor' && coach.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Требуется активация
          </h1>
          <p className="text-gray-600 mb-6">
            {!coach 
              ? 'У вас ещё нет записи в системе наставников. Нажмите кнопку ниже, чтобы стать наставником.'
              : 'Ваша учётная запись ещё не активирована как наставник.'}
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block"
            >
              Стать наставником
            </a>
            <a
              href="/catalog"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-block"
            >
              Перейти в каталог
            </a>
          </div>
        </div>
      </div>
    )
  }

  // coach уже содержит данные (id, display_name, role)
  const coachData = coach

  // Мои уроки - последние 2
  const { data: myLessons } = await supabase
    .from('lessons')
    .select('id, title, created_at')
    .eq('coach_id', coachData?.id)
    .order('created_at', { ascending: false })
    .limit(2)

  // Избранное
  const { data: favorites } = await supabase
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

  // В процессе изучения
  const { data: inProgress } = await supabase
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

  // Завершено
  const { data: completed } = await supabase
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

  // Мои покупки
  const { data: purchases } = await supabase
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

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Приветствие */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Добро пожаловать{coachData?.display_name ? `, ${coachData.display_name}` : ''}! 👋
          </h1>
          <p className="text-gray-600 mb-4">
            Управляйте своими уроками и учитесь у других наставников
          </p>
        </div>

        {/* Клиентский компонент с 2 вкладками */}
        <MentorDashboardClient
          myLessons={myLessons || []}
          favorites={favorites || []}
          inProgress={inProgress || []}
          completed={completed || []}
          purchases={purchases || []}
        />
      </div>
    </main>
  )
}