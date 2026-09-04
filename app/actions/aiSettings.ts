'use server'

import { createClient } from '@/lib/supabase/server'

// Server Action настройки «Публиковать уроки в HH:MM» (раздел «Управление с ИИ»,
// /dashboard/ai). Хранение: coaches.ai_publish_time (миграция
// 2026-09-04-agent-publish-time.sql). Эту настройку читает ИИ-агент через
// GET /api/agent/settings и ставит уроку publish_at (отложенная публикация).
// RLS coaches_update_own не даёт править чужую строку — двойная проверка не нужна.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function updateAiPublishTime(
  time: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const value = time.trim() || null
  if (value && !TIME_RE.test(value)) {
    return { ok: false, error: 'Формат времени: ЧЧ:ММ, например 08:00' }
  }

  // Пустое значение = настройка сброшена (агент публикует на своё усмотрение)
  const { error } = await supabase
    .from('coaches')
    .update({ ai_publish_time: value, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}