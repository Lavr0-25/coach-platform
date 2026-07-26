import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('role, display_name')
    .eq('user_id', user.id)
    .single()

  if (coach?.role !== 'admin') redirect('/')

  const [
    { count: activeBansCount },
    { count: newReportsCount },
    { count: usersCount },
    { count: coursesCount },
    { count: lessonsCount },
    { count: commentReportsCount },
    { count: reviewReportsCount },
    { count: totalBansCount },
    { count: newFeedbackCount }
  ] = await Promise.all([
    supabase.from('stop_list').select('*', { count: 'exact', head: true }).gte('banned_until', new Date().toISOString()),
    supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('coaches').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }),
    supabase.from('review_reports').select('*', { count: 'exact', head: true }),
    supabase.from('stop_list').select('*', { count: 'exact', head: true }),
    supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'new')
  ])

  const totalNewReports = (commentReportsCount || 0) + (reviewReportsCount || 0)

  return (
    <main className="min-h-screen bg-gray-50 py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl pb-8">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
            ⚙️ Админ-панель
          </h1>
          <p className="text-gray-600">
            Добро пожаловать, <span className="font-semibold text-purple-700">{coach.display_name || 'Администратор'}</span>!
          </p>
        </div>

        {/* Основная статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Активных блокировок" value={activeBansCount || 0} icon="🚫" color="red" />
          <StatCard title="Жалоб за 24 часа" value={totalNewReports || 0} icon="⚠️" color="orange" />
          <StatCard title="Пользователей" value={usersCount || 0} icon="👥" color="green" />
          <StatCard title="Курсов" value={coursesCount || 0} icon="📚" color="purple" />
        </div>

        {/* Дополнительная статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MiniStatCard title="Всего уроков" value={lessonsCount || 0} icon="📖" gradient="from-indigo-50 to-blue-50" border="border-indigo-200" text="text-indigo-700" />
          <MiniStatCard title="Жалоб на комментарии" value={commentReportsCount || 0} icon="💬" gradient="from-orange-50 to-red-50" border="border-orange-200" text="text-orange-700" />
          <MiniStatCard title="Жалоб на отзывы" value={reviewReportsCount || 0} icon="⭐" gradient="from-pink-50 to-purple-50" border="border-pink-200" text="text-pink-700" />
          <MiniStatCard title="Новых обращений" value={newFeedbackCount || 0} icon="📋" gradient="from-blue-50 to-cyan-50" border="border-blue-200" text="text-blue-700" />
        </div>

        {/* Меню управления */}
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full"></span>
          Управление
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminLink href="/admin/stop-list" title="Стоп-лист" desc="Управление заблокированными пользователями" icon="🚫" badge={activeBansCount} badgeColor="bg-red-100 text-red-700" />
          <AdminLink href="/admin/reports" title="Жалобы" desc="Просмотр жалоб на комментарии и отзывы" icon="🚩" badge={totalNewReports} badgeColor="bg-orange-100 text-orange-700" />
          <AdminLink href="/admin/banned-words" title="Запрещённые слова" desc="Управление списком запрещённых слов" icon="🔤" />
          <AdminLink href="/admin/feedback" title="Обратная связь" desc="Баги и предложения пользователей" icon="📋" badge={newFeedbackCount} badgeColor="bg-blue-100 text-blue-700" />
          <AdminLink href="/admin/settings" title="Настройки" desc="Параметры автоматической модерации" icon="⚙️" />
        </div>
      </div>
    </main>
  )
}

// Вспомогательные компоненты для чистоты кода
function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 md:p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-2xl md:text-3xl font-bold ${colors[color]}`}>{value}</div>
          <div className="text-xs md:text-sm text-gray-600 mt-1 font-medium">{title}</div>
        </div>
        <div className="text-3xl md:text-4xl opacity-80">{icon}</div>
      </div>
    </div>
  )
}

function MiniStatCard({ title, value, icon, gradient, border, text }: any) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border ${border} rounded-xl p-3 md:p-4`}>
      <div className="flex items-center gap-3">
        <div className="text-xl md:text-2xl">{icon}</div>
        <div>
          <div className={`text-lg md:text-xl font-bold ${text}`}>{value}</div>
          <div className={`text-xs ${text.replace('700', '600')} opacity-80`}>{title}</div>
        </div>
      </div>
    </div>
  )
}

function AdminLink({ href, title, desc, icon, badge, badgeColor }: any) {
  return (
    <Link href={href} className="group block p-5 bg-white rounded-2xl shadow-sm border border-purple-100 hover:shadow-lg hover:border-purple-300 transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-2xl group-hover:scale-110 transition-transform">{icon}</div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-3">{desc}</p>
      {badge ? (
        <div className={`inline-block ${badgeColor} text-xs px-2.5 py-1 rounded-full font-semibold`}>
          {badge} {badgeColor.includes('red') ? 'активных' : badgeColor.includes('orange') ? 'всего' : 'новых'}
        </div>
      ) : null}
    </Link>
  )
}