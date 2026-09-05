'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Подписка/отписка с публичной страницы профиля (кнопки ProfileActions).
// Почему не из браузера: FK subscriptions_coach_id_fkey требует, чтобы у цели
// была строка coaches, а у пользователя, ещё не открывавшего кабинет, её нет —
// создать её может только сервисный клиент (RLS не даст зрителю писать чужую строку).
// Проверка «уже подписан» здесь же — двойной клик не порождает дублей.

type ActionResult = { ok: true; subscribed: boolean } | { ok: false; error: string }

export async function toggleProfileSubscription(profileId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }
  if (user.id === profileId) return { ok: false, error: 'Нельзя подписаться на себя' }

  // Строка coaches у цели — обязательна для FK. Рост решён в кабинете тем же
  // способом (первый визит создаёт строку), здесь — досоздаём для всех остальных.
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Сервис недоступен' }

  const { data: coachRow } = await admin
    .from('coaches')
    .select('user_id')
    .eq('user_id', profileId)
    .maybeSingle()

  if (!coachRow) {
    const { data: target } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', profileId)
      .maybeSingle()
    if (!target) return { ok: false, error: 'Пользователь не найден' }

    const { error } = await admin
      .from('coaches')
      .insert({ user_id: profileId, display_name: target.full_name || 'Пользователь' })
    if (error) return { ok: false, error: 'Не удалось создать профиль автора' }
  }

  // Уже подписан? → отписываемся, иначе подписываемся
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('coach_id', profileId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('coach_id', profileId)
    if (error) return { ok: false, error: 'Не удалось отписаться' }
    return { ok: true, subscribed: false }
  }

  const { error } = await supabase
    .from('subscriptions')
    .insert({ user_id: user.id, coach_id: profileId })
  if (error) return { ok: false, error: 'Не удалось подписаться' }
  return { ok: true, subscribed: true }
}