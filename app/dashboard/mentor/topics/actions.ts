'use server'

import { createClient } from '@/lib/supabase/server'

// Server Actions для страницы «План тем» (/dashboard/mentor/topics).
// Чтение — на клиенте под RLS (как на остальных страницах кабинета),
// запись — через серверные действия с обязательной проверкой сессии:
// каждое действие — точка входа, доступная кому угодно по POST.

type ActionResult = { ok: boolean; error?: string }

async function requireCoachId(): Promise<
  { ok: true; coachId: string } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!coach) return { ok: false, error: 'Профиль автора не найден' }

  return { ok: true, coachId: coach.id }
}

// Добавить тему в план. title может быть пустым — легальный случай
// («автор не задал тему, агент предложит сам»); notes — необязательные пожелания.
export async function addTopic(
  title: string,
  notes: string
): Promise<ActionResult & { id?: string }> {
  const coach = await requireCoachId()
  if (!coach.ok) return { ok: false, error: coach.error }

  const cleanTitle = title.trim()
  const cleanNotes = notes.trim()
  if (!cleanTitle && !cleanNotes) {
    return { ok: false, error: 'Укажите тему или хотя бы пожелание — совсем пустую строку добавить нельзя' }
  }
  if (cleanTitle.length > 300) {
    return { ok: false, error: 'Тема слишком длинная (максимум 300 символов)' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lesson_topics')
    .insert({
      coach_id: coach.coachId,
      title: cleanTitle || null,
      notes: cleanNotes || null,
      status: 'queued',
      suggested_by: cleanTitle ? 'author' : 'agent',
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id }
}

// Удалить тему из плана. Свою — можно любую (в очереди или отложенную);
// фильтр по своему coach_id в самом запросе — чужая не удалится.
export async function deleteTopic(id: string): Promise<ActionResult> {
  const coach = await requireCoachId()
  if (!coach.ok) return { ok: false, error: coach.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('lesson_topics')
    .delete()
    .eq('id', id)
    .eq('coach_id', coach.coachId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}