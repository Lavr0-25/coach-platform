import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Lock } from 'lucide-react'
import FavoriteButton from '@/components/FavoriteButton'
import ProfileActions from '@/components/ProfileActions'
import { Card } from '@/components/ui/Card'

// Публичная страница профиля: канонические страницы материалов автора — /mentor/[id],
// поэтому если id принадлежит автору — редиректим туда. Для студента (и любого
// другого пользователя) рендерим собственную страницу: имя, аватар, пройденные курсы.
//
// Покупки читаем сервисным клиентом на сервере: RLS не даёт клиенту читать чужие
// purchases, а показывать их — суть этой страницы. Наружу идёт только минимум:
// название, обложка и цена курса (без сумм, дат платежей и прогресса по урокам).
interface MentorPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: MentorPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()
  if (!supabase) return { title: 'Профиль не найден' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', id)
    .maybeSingle()

  if (!profile) return { title: 'Профиль не найден' }

  const title = `${profile.full_name || 'Студент'} — профиль | RightWay`
  return {
    title,
    openGraph: {
      title,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  }
}

export default async function ProfilePage({ params }: MentorPageProps) {
  const { id } = await params
  const supabase = createAdminClient()
  if (!supabase) notFound()

  // Кто смотрит профиль (для кнопки «Написать сообщение» и приватности)
  const auth = await createServerClient()
  const { data: { user: viewer } } = await auth.auth.getUser()

  // Автор? → его богатый профиль
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .or(`id.eq.${id},user_id.eq.${id}`)
    .maybeSingle()
  if (coach) redirect(`/mentor/${coach.id}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, created_at, role, is_public')
    .eq('id', id)
    .maybeSingle()
  if (!profile) notFound()

  // Роль зрителя (админ видит и скрытые профили)
  let viewerRole: string | null = null
  if (viewer && viewer.id !== profile.id) {
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', viewer.id)
      .maybeSingle()
    viewerRole = viewerProfile?.role ?? null
  }

  // Профиль закрыт? → владелец и админ видят всё, остальным — заглушка
  const canViewProfile = profile.is_public || viewer?.id === profile.id || viewerRole === 'admin'
  if (!canViewProfile) {
    return (
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
        <Card variant="glow" padding="none" className="p-12 text-center">
          <div className="gradient-icon w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Профиль скрыт</h1>
          <p className="text-gray-600 max-w-md mx-auto">
            Пользователь ограничил доступ к своему профилю
          </p>
        </Card>
      </main>
    )
  }

  // Купленные курсы (только оплаченные)
  const { data: purchases } = await supabase
    .from('purchases')
    .select('course_id, courses(id, title, cover_image, price)')
    .eq('user_id', id)
    .eq('payment_status', 'completed')

  // Купленные отдельно уроки
  const { data: lessonPurchases } = await supabase
    .from('purchases')
    .select('lesson_id, lessons(id, title, cover_image, price, is_free_preview)')
    .eq('user_id', id)
    .eq('payment_status', 'completed')

  // Пройденные уроки пользователя
  const { data: doneProgress } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', id)
    .eq('status', 'completed')
  const doneLessonIds = new Set((doneProgress || []).map((r: any) => r.lesson_id))

  const courses = (purchases || [])
    .map((p: any) => p.courses)
    .filter(Boolean)
  const lessons = (lessonPurchases || [])
    .map((p: any) => p.lessons)
    .filter(Boolean)

  // Сколько уроков из купленных завершено
  const completedFromPurchases = lessons.filter((l: any) => doneLessonIds.has(l.id)).length

  const yearsOnPlatform = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )

  const getInitials = (name?: string | null) => {
    if (!name) return 'S'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  // Русское склонение: 1 курс / 2–4 курса / 0, 5–20 курсов
  const plural = (n: number, one: string, few: string, many: string) => {
    const m10 = n % 10, m100 = n % 100
    if (m10 === 1 && m100 !== 11) return one
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
    return many
  }

  const getCoursesWord = (count: number) => plural(count, 'курс', 'курса', 'курсов')
  const getLessonsWord = (count: number) => plural(count, 'урок', 'урока', 'уроков')

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Профиль пользователя */}
      <Card variant="glow" padding="none" className="p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          <div className="flex-shrink-0">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.full_name || ''} width={160} height={160} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl sm:text-6xl font-bold text-purple-600">
                  {getInitials(profile.full_name)}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                  {profile.full_name || 'Студент'}
                </h1>
                <p className="text-lg text-purple-600 font-medium">Студент платформы</p>
              </div>
              {viewer && viewer.id !== profile.id && <ProfileActions profileId={profile.id} />}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{courses.length}</div>
                <div className="text-sm text-gray-600">{getCoursesWord(courses.length)}</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{completedFromPurchases}</div>
                <div className="text-sm text-gray-600">{getLessonsWord(completedFromPurchases)} пройдено</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{yearsOnPlatform}+</div>
                <div className="text-sm text-gray-600">лет на платформе</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">
                  {new Date(profile.created_at).toLocaleDateString('ru-RU')}
                </div>
                <div className="text-sm text-gray-600">с нами с</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Купленные курсы */}
      {courses.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">🎓</span>
            Пройденные курсы
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course: any) => (
              <Link key={course.id} href={`/course/${course.id}`} className="block group">
                <Card variant="glow" padding="none" className="overflow-hidden hover:shadow-lg transition-colors border border-purple-100">
                  <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 relative overflow-hidden">
                    {course.cover_image ? (
                      <Image src={course.cover_image} alt={course.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-6xl opacity-50"></div>
                    )}
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                      {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {course.title}
                    </h3>
                    <div className="text-purple-600 font-semibold text-sm flex items-center gap-1">
                      Подробнее
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Купленные отдельные уроки */}
      {lessons.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📝</span>
            Купленные уроки
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson: any) => (
              <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="block group">
                <Card variant="glow" padding="none" className="p-5 hover:shadow-lg transition-colors border border-purple-100">
                  <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden relative">
                    {lesson.cover_image ? (
                      <Image src={lesson.cover_image} alt={lesson.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="w-full h-full object-cover" />
                    ) : (
                      <span className="opacity-50"></span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {lesson.title}
                  </h3>
                  <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                    {lesson.is_free_preview ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">Бесплатно</span>
                    ) : (
                      <span className="text-sm font-bold text-purple-700">{lesson.price} ₽</span>
                    )}
                    <div className="flex items-center gap-2">
                      <FavoriteButton itemId={lesson.id} itemType="lesson" size="sm" />
                      <span className="text-purple-600 font-semibold text-sm">Подробнее</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Пока нет ничего */}
      {courses.length === 0 && lessons.length === 0 && (
        <Card variant="glow" padding="none" className="p-12 text-center">
          <div className="text-6xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Пока нет пройденных курсов</h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Здесь появятся курсы и уроки, которые пользователь прошёл или купил
          </p>
        </Card>
      )}
    </main>
  )
}