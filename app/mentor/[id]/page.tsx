import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import MentorProfile from '@/components/MentorProfile'

interface MentorPageProps {
  params: Promise<{
    id: string
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
      images: coach.avatar_url ? [coach.avatar_url] : undefined,
    },
  }
}

export default async function MentorPage({ params }: MentorPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Существование профиля проверяем на сервере — клиент не может
  // вызывать notFound() до гидрации. Принимаем и coaches.id, и user_id
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .or(`id.eq.${id},user_id.eq.${id}`)
    .maybeSingle()

  if (!coach) notFound()

  return <MentorProfile coachId={coach.id} />
}