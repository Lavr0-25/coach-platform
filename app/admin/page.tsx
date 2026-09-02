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

  // Получаем статистику параллельно
  const [
    { count: activeBansCount },
    { count: newReportsCount },
    { count: usersCount },
    { count: coursesCount },
    { count: lessonsCount },
    { count: commentReportsCount },
    { count: reviewReportsCount },
    { count: newFeedbackCount }
  ] = await Promise.all([
    supabase.from('stop_list').select('*', { count: 'exact', head: true }).gte('banned_until', new Date().toISOString()),
    supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('coaches').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }),
    supabase.from('review_reports').select('*', { count: 'exact', head: true }),
    supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'new')
  ])

  const totalNewReports = (commentReportsCount || 0) + (reviewReportsCount || 0)

  return (
    <main className="min-h-screen bg-gray-50 py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl pb-8">
        
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
            ️ Админ-панель
          </h1>
          <p className="text-gray-600">
            Добро пожаловать, <span className="font-semibold text-purple-700">{coach.display_name || 'Администратор'}</span>!
          </p>
        </div>

        {/* Основная статистика — 4 карточки */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          <StatCard 
            title="Активных блокировок" 
            value={activeBansCount || 0} 
            icon={<BanIcon />} 
            color="red"
            href="/admin/stop-list"
          />
          <StatCard 
            title="Жалоб за 24 часа" 
            value={totalNewReports || 0} 
            icon={<AlertIcon />} 
            color="orange"
            href="/admin/reports"
          />
          <StatCard 
            title="Пользователей" 
            value={usersCount || 0} 
            icon={<UsersIcon />} 
            color="green"
            href="/admin/users"
          />
          <StatCard 
            title="Курсов" 
            value={coursesCount || 0} 
            icon={<CoursesIcon />} 
            color="purple"
            href="/admin/lessons"
          />
        </div>

        {/* Дополнительная статистика — 4 карточки */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <MiniStatCard
            title="Всего уроков"
            value={lessonsCount || 0}
            icon={<BookIcon />}
            textColor="text-indigo-700"
          />
          <MiniStatCard
            title="Жалоб на комментарии"
            value={commentReportsCount || 0}
            icon={<CommentIcon />}
            textColor="text-orange-700"
          />
          <MiniStatCard
            title="Жалоб на отзывы"
            value={reviewReportsCount || 0}
            icon={<StarIcon />}
            textColor="text-pink-700"
          />
          <MiniStatCard
            title="Новых обращений"
            value={newFeedbackCount || 0}
            icon={<FeedbackIcon />}
            textColor="text-blue-700"
          />
        </div>

        {/* Разделы управления */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full"></div>
            Управление
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AdminLink 
              href="/admin/stop-list" 
              title="Стоп-лист" 
              desc="Управление заблокированными пользователями" 
              icon={<BanIcon />} 
              badge={activeBansCount}
              badgeColor="bg-red-100 text-red-700"
              badgeText="активных"
            />
            <AdminLink 
              href="/admin/reports" 
              title="Жалобы" 
              desc="Просмотр жалоб на комментарии и отзывы" 
              icon={<AlertIcon />} 
              badge={totalNewReports}
              badgeColor="bg-orange-100 text-orange-700"
              badgeText="всего"
            />
            <AdminLink 
              href="/admin/banned-words" 
              title="Запрещённые слова" 
              desc="Управление списком запрещённых слов" 
              icon={<ForbiddenIcon />}
            />
            <AdminLink 
              href="/admin/feedback" 
              title="Обратная связь" 
              desc="Баги и предложения пользователей" 
              icon={<FeedbackIcon />} 
              badge={newFeedbackCount}
              badgeColor="bg-blue-100 text-blue-700"
              badgeText="новых"
            />
            <AdminLink 
              href="/admin/settings" 
              title="Настройки" 
              desc="Параметры автоматической модерации" 
              icon={<SettingsIcon />}
            />
            <AdminLink 
              href="/admin/users" 
              title="Пользователи" 
              desc="Управление пользователями платформы" 
              icon={<UsersIcon />}
            />
          </div>
        </div>

      </div>
    </main>
  )
}

// ========== КОМПОНЕНТЫ ==========

// Большая карточка статистики: белая карточка в стиле публичной части,
// семантический цвет — только в цифре и иконке (red=баны, orange=жалобы...)
function StatCard({ title, value, icon, color, href }: any) {
  const colors: any = {
    red: { text: 'text-red-600', iconBg: 'bg-red-100' },
    orange: { text: 'text-orange-600', iconBg: 'bg-orange-100' },
    green: { text: 'text-green-600', iconBg: 'bg-green-100' },
    purple: { text: 'text-purple-600', iconBg: 'bg-purple-100' },
  }

  const c = colors[color]

  return (
    <Link href={href} className="block group">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-3xl font-bold ${c.text} mb-1`}>{value}</div>
            <div className="text-sm text-gray-700 font-medium">{title}</div>
          </div>
          <div className={`${c.iconBg} w-14 h-14 rounded-xl flex items-center justify-center text-2xl`}>
            {icon}
          </div>
        </div>
      </div>
    </Link>
  )
}

// Маленькая карточка статистики — в том же белом стиле
function MiniStatCard({ title, value, icon, textColor }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
          <div className="text-xs text-gray-500">{title}</div>
        </div>
      </div>
    </div>
  )
}

// Карточка раздела управления
function AdminLink({ href, title, desc, icon, badge, badgeColor, badgeText }: any) {
  return (
    <Link href={href} className="group block p-5 bg-white rounded-2xl shadow-sm border border-purple-100 hover:shadow-xl hover:border-purple-300 hover:-translate-y-0.5 transition-[transform,color,background-color,border-color,box-shadow] duration-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{desc}</p>
      {badge ? (
        <div className={`inline-flex items-center gap-1.5 ${badgeColor} text-xs font-semibold px-3 py-1.5 rounded-full`}>
          <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
          {badge} {badgeText}
        </div>
      ) : null}
    </Link>
  )
}

// ========== SVG ИКОНКИ ==========

function BanIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function CoursesIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function FeedbackIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ForbiddenIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-12.728-12.728M5.636 18.364a9 9 0 0112.728-12.728" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}