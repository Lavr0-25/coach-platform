import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BookOpen, CircleUserRound, GraduationCap, Heart, Plus, Users } from 'lucide-react'

// Кабинет: сводка из двух зон («Создаю» / «Изучаю») без вкладок и дублей.
// Рабочие разделы живут на своих страницах — отсюда только обзор и переходы.

export default async function MentorDashboardPage() {
  const supabase = await createClient()

  // Серверная проверка входа (страховка к proxy.ts, который уже редиректит анонима)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Каждый зарегистрированный — автор. Строку coaches обычно создаёт триггер
  // handle_new_user при регистрации; если её нет (аномалия) — создаём при первом визите.
  let coach: { id: string; display_name: string | null } | null = null
  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coachRow) {
    coach = coachRow
  } else {
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Автор'
    const { data: created } = await supabase
      .from('coaches')
      .insert({ user_id: user.id, display_name: displayName })
      .select('id, display_name')
      .maybeSingle()
    coach = created
  }

  const coachId = coach?.id || ''

  // ── Данные для сводки ──────────────────────────────────────────────
  const [lessonsRes, coursesRes, subsRes, favRes, progressRes] = await Promise.all([
    // Мои уроки — до 5 последних
    coachId
      ? supabase
          .from('lessons')
          .select('id, title, price, is_free_preview, is_published, created_at')
          .eq('coach_id', coachId)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] } as const),
    // Счётчик курсов
    coachId
      ? supabase.from('courses').select('id', { count: 'exact', head: true }).eq('coach_id', coachId)
      : Promise.resolve({ count: 0 } as const),
    // Подписчики — уникальные user_id (дедуп вручную, как в профиле)
    supabase.from('subscriptions').select('user_id').eq('coach_id', user.id),
    // Счётчик избранного
    supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    // Прогресс изучения: started + completed
    supabase
      .from('lesson_progress')
      .select('id, status, progress_percentage, last_watched_at, lessons(id, title)')
      .eq('user_id', user.id)
      .order('last_watched_at', { ascending: false })
      .limit(3),
  ])

  const myLessons = lessonsRes.data || []
  const lessonsCount = myLessons.length
  const coursesCount = coursesRes.count || 0
  const subscribersCount = new Set((subsRes.data || []).map(s => s.user_id)).size
  const favoritesCount = favRes.count || 0
  const progress = progressRes.data || []
  const inProgress = progress.filter(p => p.status === 'started')

  const hasLearning = progress.length > 0 || favoritesCount > 0
  const hasCreation = coachId && (lessonsCount > 0 || coursesCount > 0)

  // Приветствие по времени суток
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const firstName = (coach?.display_name || 'Автор').split(' ')[0]

  // Тихие ссылки на разделы кабинета — одна навигация вместо двух
  const sectionLinks = [
    { href: '/dashboard/mentor/courses', label: 'Мои курсы' },
    { href: '/dashboard/mentor/subscribers', label: 'Подписчики' },
    { href: '/dashboard/ai', label: 'Управление с ИИ' },
    { href: '/mentor/analytics', label: 'Аналитика' },
    { href: '/dashboard/mentor/profile', label: 'Профиль' },
  ]

  // Плитки статистики — каждая ведёт в свой раздел
  const stats = [
    { href: '/dashboard/mentor/lessons', value: lessonsCount, label: 'Мои уроки' },
    { href: '/dashboard/mentor/courses', value: coursesCount, label: 'Курсы' },
    { href: '/dashboard/mentor/subscribers', value: subscribersCount, label: 'Подписчики' },
    { href: '/favorites', value: favoritesCount, label: 'Избранное' },
  ]

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Шапка: приветствие + главное действие */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Кабинет
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text mt-1">
            {greeting}, {firstName}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {hasCreation
              ? `${lessonsCount} ${plural(lessonsCount, 'урок', 'урока', 'уроков')} · ${coursesCount} ${plural(coursesCount, 'курс', 'курса', 'курсов')} · ${subscribersCount} ${plural(subscribersCount, 'подписчик', 'подписчика', 'подписчиков')}`
              : 'Здесь появится всё, что ты создаёшь и изучаешь'}
          </p>
        </div>
        <Button href="/dashboard/mentor/lessons/new">
          <Plus className="w-4 h-4" /> Создать урок
        </Button>
      </div>

      {/* Тихие ссылки на разделы кабинета */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-8">
        {sectionLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-gray-500 hover:text-purple-700 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Статистика — плитки-переходы */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="block group">
            <Card padding="sm" className="group-hover:shadow-md transition-[box-shadow] h-full">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Две зоны: Создаю / Изучаю */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 items-start">
        {/* ЗОНА: Создаю */}
        <Card padding="none" className="lg:col-span-3 overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-1">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <BookOpen className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-gray-900">Создаю</h2>
          </div>

          {hasCreation ? (
            <>
              <div className="px-5 pb-2 pt-2">
                {myLessons.length > 0 ? (
                  myLessons.slice(0, 4).map(lesson => (
                    <LessonRow key={lesson.id} lesson={lesson} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500 py-4">
                    Уроков пока нет, но есть курс — его можно дополнить.
                  </p>
                )}
              </div>
              <Link
                href="/dashboard/mentor/lessons"
                className="block px-5 py-3.5 border-t border-purple-100 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
              >
                Все уроки →
              </Link>
            </>
          ) : (
            <div className="px-5 py-6">
              <p className="text-gray-500 text-sm mb-4">
                Пока ничего не создано. Первый урок — это просто: заголовок, видео или текст, и «Опубликовать».
              </p>
              <Button href="/dashboard/mentor/lessons/new" variant="outline" size="sm">
                <Plus className="w-4 h-4" /> Создать первый урок
              </Button>
            </div>
          )}
        </Card>

        {/* ЗОНА: Изучаю */}
        <Card padding="none" className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-1">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <GraduationCap className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-gray-900">Изучаю</h2>
          </div>

          {hasLearning ? (
            <>
              <div className="px-5 pb-2 pt-2">
                {inProgress.length > 0 ? (
                  inProgress.slice(0, 2).map(item => {
                    const lesson = item.lessons as unknown as { id: string; title: string } | null
                    if (!lesson) return null
                    return (
                      <div key={item.id} className="py-3">
                        <Link
                          href={`/lesson/${lesson.id}`}
                          className="font-semibold text-sm text-gray-900 hover:text-purple-600 transition-colors"
                        >
                          {lesson.title}
                        </Link>
                        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-[width]"
                            style={{ width: `${item.progress_percentage || 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.progress_percentage || 0}% пройдено
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-gray-500 py-3">
                    Начни любой урок — прогресс появится здесь.
                  </p>
                )}
                {favoritesCount > 0 && (
                  <div className="py-3 border-t border-purple-50">
                    <Link
                      href="/favorites"
                      className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-purple-600 transition-colors"
                    >
                      <Heart className="w-4 h-4 text-purple-500" />
                      Избранное — {favoritesCount} {plural(favoritesCount, 'материал', 'материала', 'материалов')}
                    </Link>
                  </div>
                )}
              </div>
              <Link
                href="/favorites"
                className="block px-5 py-3.5 border-t border-purple-100 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
              >
                Всё, что я изучаю →
              </Link>
            </>
          ) : (
            <div className="px-5 py-6">
              <p className="text-gray-500 text-sm mb-4">
                Здесь появится всё, что ты начал изучать или сохранил.
              </p>
              <Button href="/mentors" variant="outline" size="sm">
                <CircleUserRound className="w-4 h-4" /> Найти авторов
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}

// Строка урока в зоне «Создаю»
function LessonRow({ lesson }: { lesson: any }) {
  const isPublished = lesson.is_published
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-t border-purple-50 first:border-t-0">
      <div className="min-w-0">
        <Link
          href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
          className="font-semibold text-sm text-gray-900 hover:text-purple-600 transition-colors block truncate"
        >
          {lesson.title}
        </Link>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
          {' · '}
          {lesson.price > 0 && !lesson.is_free_preview ? `${lesson.price} ₽` : 'бесплатно'}
        </p>
      </div>
      <Badge variant={isPublished ? 'green' : 'orange'} className="flex-shrink-0">
        {isPublished ? 'Опубликован' : 'Черновик'}
      </Badge>
    </div>
  )
}

// Склонение: plural(2, 'урок', 'урока', 'уроков') → «урока»
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}