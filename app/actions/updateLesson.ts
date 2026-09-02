'use server'

import { createClient } from '@/lib/supabase/server'

// Server Action для редактирования урока и его контента.
// Владелец проверяется на сервере: .eq('coach_id', coach.id) в запросе,
// пустой .select() = строка не обновилась → ошибка, а не «Сохранено».

type ActionResult = { ok: true } | { ok: false; error: string }

// Публикация/снятие с публикации урока — отдельное действие,
// чтобы «Сохранить» не меняло видимость урока неожиданно.
export async function setLessonPublished(lessonId: string, published: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  const { data, error: updateError } = await supabase
    .from('lessons')
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден или нет прав на изменение' }
  }
  return { ok: true }
}

export async function updateLesson(
  lessonId: string,
  fields: {
    title: string
    description: string
    price: number
    is_free_preview: boolean
    cover_image: string | null
  },
  content: {
    content_type: string
    content_url: string
    title: string | null
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  const { data, error: lessonError } = await supabase
    .from('lessons')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (lessonError) return { ok: false, error: lessonError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден или нет прав на изменение' }
  }

  // Контент: обновляем существующую запись или создаём новую.
  // Урок уже проверен выше — lesson_id здесь гарантированно наш.
  const { data: existingContent } = await supabase
    .from('lesson_content')
    .select('id')
    .eq('lesson_id', lessonId)
    .single()

  let contentError
  if (existingContent) {
    const { error } = await supabase
      .from('lesson_content')
      .update({
        content_type: content.content_type,
        content_url: content.content_url,
        title: content.title,
      })
      .eq('id', existingContent.id)
    contentError = error
  } else {
    const { error } = await supabase
      .from('lesson_content')
      .insert({
        lesson_id: lessonId,
        content_type: content.content_type,
        content_url: content.content_url,
        title: content.title,
        order_index: 0,
      })
    contentError = error
  }

  if (contentError) return { ok: false, error: contentError.message }
  return { ok: true }
}