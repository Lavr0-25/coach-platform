import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import MentorDashboardClient from './MentorDashboardClient'

export default async function MentorDashboard() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role && profile.role !== 'mentor' && profile.role !== 'admin') {
    redirect('/')
  }

  // Получаем coach_id
  const { data: coachData } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('user_id', user.id)
    .single()

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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

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
    </div>
  )
}