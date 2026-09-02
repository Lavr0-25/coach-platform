'use server'

import { createClient } from '@/lib/supabase/server'

// Server Action для удаления урока наставником (своего — .eq('coach_id', coach.id)).
// Связанные строки (lesson_content, прогресс, лайки, course_lessons и др.)
// чистит база через ON DELETE CASCADE — см. docs/specs/lessons.md.
// Файлы в Storage (обложка, PDF/картинки контента) остаются — осиротевшие
// объекты бакетов чистятся отдельной задачей, не блокируем удаление на них.

type ActionResult = { ok: true } | { ok: false; error: string }

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  const { data, error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден или нет прав на удаление' }
  }
  return { ok: true }
}