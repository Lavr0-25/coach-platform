import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UsersList from './UsersList'
import Breadcrumbs from '@/components/Breadcrumbs'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  
  const searchQuery = typeof params.search === 'string' ? params.search : ''
  const filterRole = typeof params.role === 'string' ? params.role : 'all'

  // 1. Получаем всех пользователей
  let profilesQuery = supabase
    .from('profiles')
    .select('*')

  // Фильтр по роли
  if (filterRole !== 'all') {
    if (filterRole === 'author') {
      profilesQuery = profilesQuery.eq('role', 'mentor')
    } else if (filterRole === 'student') {
      profilesQuery = profilesQuery.eq('role', 'student')
    } else {
      profilesQuery = profilesQuery.eq('role', filterRole)
    }
  }

  // Текстовый поиск
  if (searchQuery) {
    profilesQuery = profilesQuery.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
  }

  const { data: profiles, error: profilesError } = await profilesQuery
    .order('created_at', { ascending: false })

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError)
  }

  // 2. Получаем всех coaches
  const { data: coaches } = await supabase
    .from('coaches')
    .select('id, user_id, display_name, role, is_verified')

  // 3. Считаем ВСЕ уроки для каждого coach
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, coach_id')

  // 4. Считаем ВСЕ курсы для каждого coach
  const { data: allCourses } = await supabase
    .from('courses')
    .select('id, coach_id')

  // 5. 🔥 Считаем подписчиков для каждого coach
  // subscriptions.coach_id ссылается на profiles.id (а не на coaches.user_id!)
  const { data: allSubscriptions } = await supabase
    .from('subscriptions')
    .select('coach_id')

  // 6. Получаем весь прогресс для подсчёта уникальных студентов
  const { data: allProgress } = await supabase
    .from('lesson_progress')
    .select('lesson_id, user_id')

  // 7. Получаем баны
  const { data: userBans } = await supabase
    .from('user_bans')
    .select('id, user_id, reason, is_active, banned_at, unbanned_at')
    .eq('is_active', true)

  //  Агрегируем данные
  const lessonsCount = new Map<string, number>()
  allLessons?.forEach(l => {
    lessonsCount.set(l.coach_id, (lessonsCount.get(l.coach_id) || 0) + 1)
  })

  const coursesCount = new Map<string, number>()
  allCourses?.forEach(c => {
    coursesCount.set(c.coach_id, (coursesCount.get(c.coach_id) || 0) + 1)
  })

  // 🔥 Подсчёт подписчиков по profiles.id (так как subscriptions.coach_id = profiles.id)
  const subscribersCountByProfileId = new Map<string, number>()
  allSubscriptions?.forEach(s => {
    subscribersCountByProfileId.set(s.coach_id, (subscribersCountByProfileId.get(s.coach_id) || 0) + 1)
  })

  //  Подсчёт уникальных студентов по lesson_progress
  const lessonToCoachMap = new Map<string, string>()
  allLessons?.forEach(l => {
    lessonToCoachMap.set(l.id, l.coach_id)
  })

  const studentsCountByCoach = new Map<string, number>()
  const coachUserPairs = new Set<string>()
  
  allProgress?.forEach(p => {
    const coachId = lessonToCoachMap.get(p.lesson_id)
    if (coachId) {
      const pairKey = `${coachId}-${p.user_id}`
      if (!coachUserPairs.has(pairKey)) {
        coachUserPairs.add(pairKey)
        const currentCount = studentsCountByCoach.get(coachId) || 0
        studentsCountByCoach.set(coachId, currentCount + 1)
      }
    }
  })

  const bansMap = new Map<string, any[]>()
  userBans?.forEach(b => {
    if (!bansMap.has(b.user_id)) {
      bansMap.set(b.user_id, [])
    }
    bansMap.get(b.user_id)!.push(b)
  })

  //  Создаём мапу: user_id → coach data с правильными счётчиками
  const coachesMap = new Map<string, any>()
  coaches?.forEach(c => {
    coachesMap.set(c.user_id, {
      ...c,
      lessons_count: lessonsCount.get(c.id) || 0,
      courses_count: coursesCount.get(c.id) || 0,
      subscribers_count: subscribersCountByProfileId.get(c.user_id) || 0, // 🔥 c.user_id = profiles.id
    })
  })

  // 🔥 Объединяем профили с данными coaches
  const allUsers = (profiles || []).map(profile => ({
    ...profile,
    coaches: coachesMap.has(profile.id) ? [coachesMap.get(profile.id)] : [],
    user_bans: bansMap.has(profile.id) ? bansMap.get(profile.id) : [],
    lessons_count: coachesMap.get(profile.id)?.lessons_count || 0,
    courses_count: coachesMap.get(profile.id)?.courses_count || 0,
    subscribers_count: subscribersCountByProfileId.get(profile.id) || 0, // 🔥 profile.id
  }))

  //  Статистика (всегда по всем пользователям)
  const allProfilesQuery = await supabase.from('profiles').select('role')
  const allProfiles = allProfilesQuery.data || []
  
  const authorsCount = allProfiles.filter(p => p.role === 'mentor').length
  const studentsCount = allProfiles.filter(p => p.role === 'student').length
  const adminCount = allProfiles.filter(p => p.role === 'admin').length
  const totalUsers = allProfiles.length

  const stats = [
    { title: 'Всего пользователей', value: totalUsers, color: 'gray' as const },
    { title: 'Администраторов', value: adminCount, color: 'red' as const },
    { title: 'Авторов', value: authorsCount, color: 'green' as const },
    { title: 'Студентов', value: studentsCount, color: 'blue' as const },
  ]

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <Breadcrumbs />

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold gradient-text mb-2">
            👥 Управление пользователями
          </h1>
          <p className="text-gray-600 text-sm">
            Просмотр, поиск и управление учетными записями платформы
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {stats.map((stat, index) => (
            <StatCard key={index} title={stat.title} value={stat.value} color={stat.color} />
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 md:p-6 mb-6">
          <form className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="search"
                placeholder="Поиск по имени или email..."
                defaultValue={searchQuery}
                className="w-full pl-10 pr-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all bg-white"
              />
            </div>
            
            <select
              name="role"
              defaultValue={filterRole}
              className="w-full sm:w-auto px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all bg-white"
            >
              <option value="all">Все роли</option>
              <option value="admin">Администраторы</option>
              <option value="author">Авторы</option>
              <option value="student">Студенты</option>
            </select>
            
            <button
              type="submit"
              className="w-full sm:w-auto gradient-btn text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Найти
            </button>
            
            {(searchQuery || filterRole !== 'all') && (
              <Link
                href="/admin/users"
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-center"
              >
                Сбросить
              </Link>
            )}
          </form>
        </div>

        <UsersList initialUsers={allUsers} />
      </div>
    </main>
  )
}

function StatCard({ title, value, color }: { title: string; value: number; color: 'gray' | 'red' | 'green' | 'blue' }) {
  const styles = {
    gray: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700',
    red: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-700',
    green: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700',
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-700',
  }
  
  return (
    <div className={`rounded-2xl border p-4 ${styles[color]}`}>
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
      <div className="text-xs md:text-sm opacity-80 mt-1 font-medium">{title}</div>
    </div>
  )
}