'use server'

import { createClient } from '@/lib/supabase/server'

// Server Actions для редактирования курса.
// Проверка владельца происходит ЗДЕСЬ, на сервере: пользователь не может
// подделать эти запросы напрямую (в отличие от вызовов из браузера).
// Фильтр .eq('coach_id', coach.id) в самом запросе — вторая ступень:
// даже при ошибке проверки чужая строка просто не найдётся.
// Результат — { ok } или { error }: форма показывает error без throw.

type ActionResult = { ok: true } | { ok: false; error: string }

async function getCoachId(): Promise<{ coachId: string | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { coachId: null, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!coach) return { coachId: null, error: 'Профиль наставника не найден' }
  return { coachId: coach.id }
}

async function assertCourseOwned(courseId: string, coachId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('coach_id', coachId)
    .maybeSingle()

  if (!course) return 'Курс не найден или нет прав на изменение'
  return null
}

export async function updateCourse(
  courseId: string,
  fields: {
    title: string
    description: string | null
    price: number
    is_published: boolean
    cover_image_url: string | null
  }
): Promise<ActionResult> {
  const { coachId, error } = await getCoachId()
  if (!coachId) return { ok: false, error: error! }

  const supabase = await createClient()
  // cover_image — старое поле-дубль: пишем в него же, пока код читает оба
  // (стандартизируем на cover_image_url, дроп старой колонки — позже)
  const { data, error: updateError } = await supabase
    .from('courses')
    .update({
      ...fields,
      cover_image: fields.cover_image_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .eq('coach_id', coachId) // ← только свой курс
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  // .select() вернёт массив: пустой = ни одна строка не обновилась
  // (чужой курс или RLS-тихий отказ) — сообщаем об ошибке, а не «Сохранено».
  if (!data || data.length === 0) {
    return { ok: false, error: 'Курс не найден или нет прав на изменение' }
  }
  return { ok: true }
}

export async function setCoursePublished(courseId: string, published: boolean): Promise<ActionResult> {
  const { coachId, error } = await getCoachId()
  if (!coachId) return { ok: false, error: error! }

  const supabase = await createClient()
  const { data, error: updateError } = await supabase
    .from('courses')
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .eq('coach_id', coachId) // ← только свой курс
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Курс не найден или нет прав на изменение' }
  }
  return { ok: true }
}

export async function attachLessonToCourse(courseId: string, lessonId: string): Promise<ActionResult> {
  const { coachId, error } = await getCoachId()
  if (!coachId) return { ok: false, error: error! }

  const courseError = await assertCourseOwned(courseId, coachId)
  if (courseError) return { ok: false, error: courseError }

  const supabase = await createClient()

  // Урок должен быть своим — иначе чужой урок «притянется» в курс
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('coach_id', coachId)
    .maybeSingle()

  if (!lesson) return { ok: false, error: 'Урок не найден среди ваших уроков' }

  // Порядковый номер считаем на сервере, а не верим клиенту
  const { count } = await supabase
    .from('course_lessons')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)

  const { error: insertError } = await supabase
    .from('course_lessons')
    .insert({
      course_id: courseId,
      lesson_id: lessonId,
      order_index: (count ?? 0) + 1,
    })

  // Нарушение уникальности (course_id, lesson_id) = урок уже в курсе
  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, error: 'Этот урок уже добавлен в курс' }
    }
    return { ok: false, error: insertError.message }
  }
  return { ok: true }
}

export async function detachLessonFromCourse(courseId: string, lessonId: string): Promise<ActionResult> {
  const { coachId, error } = await getCoachId()
  if (!coachId) return { ok: false, error: error! }

  const courseError = await assertCourseOwned(courseId, coachId)
  if (courseError) return { ok: false, error: courseError }

  const supabase = await createClient()
  const { data, error: deleteError } = await supabase
    .from('course_lessons')
    .delete()
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId)
    .select('id')

  if (deleteError) return { ok: false, error: deleteError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден в этом курсе' }
  }
  return { ok: true }
}

export async function reorderCourseLessons(
  courseId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const { coachId, error } = await getCoachId()
  if (!coachId) return { ok: false, error: error! }

  const courseError = await assertCourseOwned(courseId, coachId)
  if (courseError) return { ok: false, error: courseError }

  const supabase = await createClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { data, error: updateError } = await supabase
      .from('course_lessons')
      .update({ order_index: i + 1 })
      .eq('course_id', courseId)
      .eq('lesson_id', orderedIds[i])
      .select('id')

    if (updateError) return { ok: false, error: updateError.message }
    if (!data || data.length === 0) {
      return { ok: false, error: 'Урок не найден в этом курсе' }
    }
  }
  return { ok: true }
}