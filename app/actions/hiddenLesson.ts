'use server'

import { createClient } from '@/lib/supabase/server'

// Скрытые уроки (2026-09-04): режим «не в каталоге/поиске, доступ по ссылке
// и/или личному допуску автора». Миграция: docs/migrations/2026-09-04-hidden-lessons.sql.
// Владелец проверяется на сервере (.eq('coach_id', coach.id) + .select('id') —
// пусто = нет прав), как во всех экшенах уроков.

type ActionResult = { ok: true } | { ok: false; error: string }
type DetachResult = { ok: true; detachedCourse: boolean } | { ok: false; error: string }

// Включение/выключение скрытого режима урока.
// При включении: урок обязан иметь сохранённый контент (иначе допущенный по
// ссылке увидит заглушку), отвязывается от курса (скрытый урок — всегда
// самостоятельный) и сразу становится «опубликованным» (is_published=true) —
// его видимость теперь определяется is_hidden + lesson_access.
// При выключении: урок возвращается в обычный опубликованный режим.
export async function setLessonHidden(lessonId: string, hidden: boolean): Promise<DetachResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  if (hidden) {
    // Контент обязателен — как при обычной публикации
    const { data: contents } = await supabase
      .from('lesson_content')
      .select('content_type, content_url, content_html')
      .eq('lesson_id', lessonId)
      .limit(1)

    const content = contents?.[0]
    const hasContent = !!content && (content.content_type === 'text'
      ? !!(content.content_html || '').replace(/<[^>]*>/g, '').trim()
      : !!(content.content_url || '').trim())

    if (!hasContent) {
      return { ok: false, error: 'Сначала заполните и сохраните контент урока — скрытый урок без текста никто не увидит' }
    }
  }

  // Связь с курсом живёт в course_lessons (join-таблица): читаем ДО обновления,
  // чтобы UI мог предупредить об отвязке. Скрытый урок — всегда самостоятельный.
  const { data: courseLinks } = await supabase
    .from('course_lessons')
    .select('id, course_id')
    .eq('lesson_id', lessonId)

  const detachedCourse = hidden && (courseLinks?.length ?? 0) > 0

  const { data, error: updateError } = await supabase
    .from('lessons')
    .update({
      is_hidden: hidden,
      is_published: true,
      publish_at: null, // расписание не имеет смысла — скрытый урок уже «опубликован»
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден или нет прав на изменение' }
  }

  // При включении скрытого режима убираем урок из всех курсов
  if (detachedCourse) {
    const { error: detachError } = await supabase
      .from('course_lessons')
      .delete()
      .eq('lesson_id', lessonId)
    if (detachError) return { ok: false, error: detachError.message }
  }

  return { ok: true, detachedCourse }
}

// Приём по ссылке для скрытого урока: true — перешедший по ссылке попадает
// в список допущенных автоматически (с пометкой «по ссылке»), false —
// только по личному приглашению автора (ссылка перестаёт открывать).
export async function setLessonLinkAccess(lessonId: string, enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  const { error: updateError } = await supabase
    .from('lessons')
    .update({ link_access: enabled, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}

// Личное приглашение: автор добавляет пользователя в список допущенных
// (source='manual'). Если человек раньше приходил по ссылке и доступ был
// отозван — строка не создаётся заново (unique), а «разоткывается».
export async function addLessonAccess(lessonId: string, targetUserId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  // Проверяем, что урок наш и скрытый (допуски существуют только у скрытых)
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, is_hidden')
    .eq('id', lessonId)
    .eq('coach_id', coach.id)
    .single()

  if (!lesson) return { ok: false, error: 'Урок не найден или нет прав на изменение' }
  if (!lesson.is_hidden) return { ok: false, error: 'Сначала включите скрытый режим урока' }

  // Пользователь должен существовать (защита от подставного id).
  // profiles.id совпадает с id пользователя из auth.users.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', targetUserId)
    .single()

  if (!profile) return { ok: false, error: 'Пользователь не найден' }

  // Есть ли уже строка (в т.ч. отозванная)?
  const { data: existing } = await supabase
    .from('lesson_access')
    .select('id, revoked')
    .eq('lesson_id', lessonId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existing) {
    if (!existing.revoked) {
      return { ok: false, error: 'Этот человек уже имеет доступ к уроку' }
    }
    const { error: updateError } = await supabase
      .from('lesson_access')
      .update({ revoked: false, source: 'manual', added_by: user.id })
      .eq('id', existing.id)
    if (updateError) return { ok: false, error: updateError.message }
    return { ok: true }
  }

  const { error: insertError } = await supabase
    .from('lesson_access')
    .insert({
      lesson_id: lessonId,
      user_id: targetUserId,
      source: 'manual',
      added_by: user.id,
    })

  if (insertError) {
    return { ok: false, error: insertError.code === '23505'
      ? 'Этот человек уже имеет доступ к уроку'
      : insertError.message }
  }
  return { ok: true }
}

// Отзыв доступа: revoked=true, строка остаётся — иначе unique(lesson_id,user_id)
// не помешал бы отозванному зайти по ссылке снова и само-добавиться.
export async function revokeLessonAccess(lessonId: string, accessId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  // Строка должна принадлежать нашему уроку — проверяем владельца урока,
  // потом отзываем по id строки (RLS дублирует проверку со стороны БД)
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('coach_id', coach.id)
    .single()

  if (!lesson) return { ok: false, error: 'Урок не найден или нет прав на изменение' }

  const { data, error: updateError } = await supabase
    .from('lesson_access')
    .update({ revoked: true })
    .eq('id', accessId)
    .eq('lesson_id', lessonId)
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Доступ не найден или нет прав на изменение' }
  }
  return { ok: true }
}