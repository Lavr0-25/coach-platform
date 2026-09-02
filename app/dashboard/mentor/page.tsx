import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MentorDashboardClient from './MentorDashboardClient'

// Кабинет автора (главная дашборда). Раньше маршрут был 404 — на него вели
// 11 ссылок («Назад в кабинет», «Стать автором», меню в Navbar).
export default async function MentorDashboardPage() {
  const supabase = await createClient()

  // Серверная проверка входа (страховка к proxy.ts, который уже редиректит анонима)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Каждый зарегистрированный — автор. Строку coaches обычно создаёт триггер
  // handle_new_user при регистрации; если её нет (аномалия) — создаём при первом визите.
  let { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!coach) {
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Автор'
    const { data: created } = await supabase
      .from('coaches')
      .insert({ user_id: user.id, display_name: displayName })
      .select('id')
      .maybeSingle()
    coach = created
  }

  // Данные наставника: его уроки
  let myLessons: any[] = []
  if (coach) {
    const { data } = await supabase
      .from('lessons')
      .select('id, title, price, is_free_preview, created_at')
      .eq('coach_id', coach.id)
      .order('created_at', { ascending: false })
    myLessons = data || []
  }

  // Данные ученика: избранное (с вложенным уроком через FK)
  const { data: favorites } = await supabase
    .from('favorites')
    .select('id, lesson_id, course_id, group_name, created_at, lessons(id, title)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Прогресс обучения: status = 'started' | 'completed' (см. components/LessonProgress.tsx)
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('id, status, progress_percentage, last_watched_at, lessons(id, title)')
    .eq('user_id', user.id)
    .order('last_watched_at', { ascending: false })

  const inProgress = (progress || []).filter(p => p.status === 'started')
  const completed = (progress || []).filter(p => p.status === 'completed')

  // Покупки (оплаченные)
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, amount, purchased_at, lessons(id, title)')
    .eq('user_id', user.id)
    .eq('payment_status', 'completed')
    .order('purchased_at', { ascending: false })

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
          Кабинет автора
        </h1>
        <p className="text-gray-600 mt-2">
          Ваши уроки, курсы и обучение
        </p>

        {/* Быстрые ссылки по разделам кабинета */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { href: '/dashboard/mentor/lessons', label: 'Мои уроки' },
            { href: '/dashboard/mentor/courses', label: 'Мои курсы' },
            { href: '/dashboard/mentor/profile', label: 'Профиль автора' },
            { href: '/dashboard/mentor/subscribers', label: 'Подписчики' },
            { href: '/mentor/analytics', label: 'Аналитика' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white text-purple-700 border border-purple-200 px-4 py-2 rounded-lg font-medium text-sm hover:bg-purple-50 transition-all"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <MentorDashboardClient
        coachId={coach?.id || ''}
        myLessons={myLessons}
        favorites={favorites || []}
        inProgress={inProgress}
        completed={completed}
        purchases={purchases || []}
      />
    </main>
  )
}