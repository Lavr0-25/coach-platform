'use server'

import { createClient } from '@/lib/supabase/server'

// Server Action для удаления урока наставником (своего — .eq('coach_id', coach.id)).
// Связанные строки (lesson_content, прогресс, лайки, course_lessons и др.)
// чистит база через ON DELETE CASCADE — см. docs/specs/lessons.md.
//
// Правило (решение Анатолия, 2026-09-03): урок с покупками автор удалить НЕ может
// — каскад стёр бы историю оплат. Такое удаление делает только админ
// (deleteLesson в app/admin/actions.ts). Автор получает ошибку-подсказку.
//
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

  // Урок с покупками автору удалять нельзя — каскад стёр бы записи о деньгах.
  // Такое удаление делает только админ (см. app/admin/actions.ts).
  const { count } = await supabase
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_id', lessonId)
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        'Урок уже купили — удалятся записи о покупках, поэтому удаление делает только администрация. Скрыть урок от тех, кто ещё не покупал, можно, вернув его в черновик (но покупатели временно потеряют доступ).',
    }
  }

  // Удаляем контент явно (тот же порядок, что в админском deleteLesson),
  // затем сам урок — фильтр по coach_id: чужой не удалится (0 строк → ошибка)
  const { error: contentError } = await supabase
    .from('lesson_content')
    .delete()
    .eq('lesson_id', lessonId)
  if (contentError) return { ok: false, error: contentError.message }

  const { data, error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден или нет прав на изменение' }
  }
  return { ok: true }
}