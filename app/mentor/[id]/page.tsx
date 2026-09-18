import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import MentorProfile from '@/components/MentorProfile'
import { ogCardUrl } from '@/lib/seo'
import { isBot, resolveSource } from '@/lib/utm'

interface MentorPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    utm_source?: string
    utm_campaign?: string
  }>
}

// Мета-теги профиля наставника — для поисковиков и ИИ-агентов
export async function generateMetadata({ params }: MentorPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  // В id может прийти как id наставника (coaches.id), так и user_id (id профиля) —
  // в кодовой странице ссылаются и так, и так (чат, лента, подписчики)
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, display_name, specialization, bio, avatar_url')
    .or(`id.eq.${id},user_id.eq.${id}`)
    .maybeSingle()

  if (!coach) return { title: 'Наставник не найден' }

  const title = coach.specialization
    ? `${coach.display_name || 'Наставник'} — ${coach.specialization}`
    : coach.display_name || 'Наставник'
  const description = (coach.bio || 'Профиль наставника на платформе RightWay').slice(0, 160)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [coach.avatar_url || ogCardUrl(title)],
    },
  }
}

export default async function MentorPage({ params, searchParams }: MentorPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Существование профиля проверяем на сервере — клиент не может
  // вызывать notFound() до гидрации. Принимаем и coaches.id, и user_id
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, user_id, display_name, specialization, bio, avatar_url, is_verified')
    .or(`id.eq.${id},user_id.eq.${id}`)
    .maybeSingle()

  if (!coach) notFound()

  // Просмотр страницы автора (для статистики «Поделиться»: переходы по
  // поделенным ссылкам видны по metadata.source = 'share'; тип 'profile_view'
  // был зарезервирован в CHECK/RLS с 2026-09-03, пишем с 2026-09-18).
  // target_id — user_id автора: его же проверяет SELECT-политика аналитики.
  {
    const [{ utm_source }, hdrs] = await Promise.all([searchParams, headers()])
    const userAgent = hdrs.get('user-agent')
    if (!isBot(userAgent)) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('analytics_events').insert({
        event_type: 'profile_view',
        user_id: user?.id ?? null,
        target_id: coach.user_id,
        target_type: 'profile',
        metadata: { source: resolveSource(utm_source, hdrs.get('referer')) },
      })
    }
  }

  // JSON-LD для поисковиков (фича Б, 2026-09-18): профиль автора как Person.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: coach.display_name || 'Автор',
    ...(coach.specialization ? { jobTitle: coach.specialization } : {}),
    ...(coach.bio ? { description: coach.bio.slice(0, 300) } : {}),
    ...(coach.avatar_url ? { image: coach.avatar_url } : {}),
    url: `https://www.rightway.su/mentor/${coach.id}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MentorProfile coachId={coach.id} />
    </>
  )
}