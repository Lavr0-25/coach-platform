import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

// Дубль профиля автора закрыт: каноническая страница — /mentor/[id] (богатый профиль).
// Здесь только резолвим id и редиректим, чтобы старые ссылки продолжали работать.
// id бывает двух типов: user_id (ссылки из комментариев и отзывов) или coaches.id.
export default async function ProfileRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Сначала пробуем как user_id (основной случай — комментарии/отзывы)
  const { data: byUser } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', id)
    .maybeSingle()

  const coachId = byUser?.id
    ? byUser.id
    : (await supabase.from('coaches').select('id').eq('id', id).maybeSingle()).data?.id

  if (!coachId) notFound()

  redirect(`/mentor/${coachId}`)
}