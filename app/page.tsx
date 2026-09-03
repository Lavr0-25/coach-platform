import { createClient } from '@/lib/supabase/server'
import HomeFeed, { type HomeItem, type HomeCoach, type HomeSubscription } from '@/components/HomeFeed'

// Главная — server component: контент (уроки, курсы, рейтинги, авторы) тянется
// на сервере, поэтому первый кадр содержит данные (SSR) и виден поисковикам
// и ИИ-агентам. Интерактивность — в клиентском HomeFeed.

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [coachesRes, lessonsRes, coursesRes, lessonReviewsRes, courseReviewsRes, subsRes] =
    await Promise.all([
      supabase
        .from('coaches')
        .select('id, user_id, display_name, avatar_url, specialization')
        .order('display_name'),
      supabase
        .from('lessons')
        .select('id, title, description, cover_image, price, is_free_preview, created_at, coach_id, coach:coaches!lessons_coach_id_fkey(display_name, avatar_url)')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('courses')
        .select('id, title, description, cover_image, cover_image_url, price, created_at, coach_id, coach:coaches!courses_coach_id_fkey(display_name, avatar_url)')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      supabase.from('reviews').select('lesson_id, rating').not('lesson_id', 'is', null),
      supabase.from('course_reviews').select('course_id, rating'),
      user
        ? supabase
            .from('subscriptions')
            .select('coach_id, coach:coaches(display_name, avatar_url, specialization)')
            .eq('user_id', user.id)
            .order('subscribed_at', { ascending: false })
        : Promise.resolve({ data: [] as HomeSubscription[] }),
    ])

  // Агрегаты рейтингов одним запросом на тип (вместо запроса на каждый элемент)
  const buildStats = <T extends { rating: number }>(
    rows: T[] | null,
    keyOf: (r: T) => string | null
  ) => {
    const stats = new Map<string, { sum: number; count: number }>()
    for (const r of rows ?? []) {
      const key = keyOf(r)
      if (!key) continue
      const s = stats.get(key) ?? { sum: 0, count: 0 }
      s.sum += r.rating
      s.count += 1
      stats.set(key, s)
    }
    return stats
  }

  const lessonStats = buildStats(lessonReviewsRes.data, (r) => r.lesson_id)
  const courseStats = buildStats(courseReviewsRes.data, (r) => r.course_id)

  // Встроенный join `coach:coaches(...)` supabase-js типизирует как массив —
  // нормализуем к одному объекту
  const oneCoach = (c: unknown): HomeItem['coach'] => {
    if (Array.isArray(c)) return c[0] ?? null
    return (c as HomeItem['coach']) ?? null
  }

  const items: HomeItem[] = [
    ...(lessonsRes.data ?? []).map((l) => ({
      id: l.id,
      type: 'lesson' as const,
      title: l.title,
      description: l.description,
      cover_image: l.cover_image,
      // У уроков флаг называется is_free_preview (is_free у таблицы нет —
      // раньше бейдж «Бесплатно» у уроков не показывался)
      is_free: l.is_free_preview === true,
      price: Number(l.price) || 0,
      created_at: l.created_at,
      coach_id: l.coach_id,
      rating: lessonStats.has(l.id)
        ? lessonStats.get(l.id)!.sum / lessonStats.get(l.id)!.count
        : 0,
      reviews_count: lessonStats.get(l.id)?.count ?? 0,
      coach: oneCoach(l.coach),
    })),
    ...(coursesRes.data ?? []).map((c) => ({
      id: c.id,
      type: 'course' as const,
      title: c.title,
      description: c.description,
      cover_image: c.cover_image || c.cover_image_url,
      is_free: false, // у курсов есть только цена
      price: Number(c.price) || 0,
      created_at: c.created_at,
      coach_id: c.coach_id,
      rating: courseStats.has(c.id)
        ? courseStats.get(c.id)!.sum / courseStats.get(c.id)!.count
        : 0,
      reviews_count: courseStats.get(c.id)?.count ?? 0,
      coach: oneCoach(c.coach),
    })),
  ]

  const coaches: HomeCoach[] = coachesRes.data ?? []
  const subscriptions: HomeSubscription[] = (subsRes.data as HomeSubscription[]) ?? []

  return (
    <HomeFeed
      initialItems={items}
      coaches={coaches}
      initialUser={user ? { id: user.id } : null}
      initialSubscriptions={subscriptions}
    />
  )
}