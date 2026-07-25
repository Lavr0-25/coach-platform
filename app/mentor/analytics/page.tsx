import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('user_id', user.id)
    .single()

  if (!coach) {
    redirect('/dashboard/mentor')
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor/profile" className="hover:text-purple-600 transition-colors">
          Личный кабинет
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Аналитика</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-6">
         Аналитика
      </h1>

      <div className="style-card p-12 text-center">
        <div className="text-6xl mb-4">📈</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Статистика в разработке
        </h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Здесь будет отображаться статистика просмотров, прогресс обучения и графики активности
        </p>
        <Link
          href="/dashboard/mentor/profile"
          className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Вернуться в кабинет
        </Link>
      </div>
    </main>
  )
}