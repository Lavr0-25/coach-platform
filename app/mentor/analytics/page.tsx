import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

// Ленивая загрузка компонента аналитики
const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard'),
  {
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    ),
    ssr: false // Отключаем SSR для тяжёлой аналитики
  }
)

export default async function MentorAnalyticsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!coach || (coach.role !== 'mentor' && coach.role !== 'admin')) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <AnalyticsDashboard />
      </div>
    </main>
  )
}