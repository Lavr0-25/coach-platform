'use server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeLessonHtml } from '@/lib/editor/sanitizeLessonHtml'

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
    .maybeSingle()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  // Публиковать можно только урок с сохранённым контентом — иначе студент
  // увидит заглушку. Проверяем по lesson_content: для текста нужен непустой
  // HTML (вне тегов), для остальных типов — ссылка/файл.
  if (published) {
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
      return { ok: false, error: 'Сначала заполните и сохраните контент урока — публиковать пустой урок нельзя' }
    }
  }

  const { data, error: updateError } = await supabase
    .from('lessons')
    .update({
      is_published: published,
      // Ручная публикация перекрывает расписание — снимаем его. При снятии тоже
      // чистим publish_at: иначе старое расписание в прошлом снова опубликует
      // урок планировщиком сразу после «Вернуть в черновик».
      publish_at: null,
      // Фактический момент публикации — для карточек «Мои уроки»
      published_at: published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId)
    .eq('coach_id', coach.id) // ← только свой урок
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Урок не найден или нет прав на изменение' }
  }
  return { ok: true }
}

// Публикация по расписанию: автор задаёт/отменяет момент публикации (publish_at).
// В назначенное время урок откроет планировщик в БД (pg_cron, миграция
// 2026-09-03-scheduled-publish.sql) — только если контент непустой, иначе урок
// останется черновиком. null = отменить расписание.
export async function setLessonPublishAt(lessonId: string, publishAt: string | null): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!coach) return { ok: false, error: 'Профиль наставника не найден' }

  const when = publishAt ? new Date(publishAt) : null
  if (publishAt && (!when || isNaN(when.getTime()))) {
    return { ok: false, error: 'Некорректная дата публикации' }
  }
  if (when && when.getTime() <= Date.now()) {
    return { ok: false, error: 'Время публикации уже прошло — укажите будущее' }
  }

  // Свой урок. Расписание работает и для опубликованных: установка = сразу
  // снять с публикации, планировщик откроет урок в назначенное время (вариант А).
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, is_published')
    .eq('id', lessonId)
    .eq('coach_id', coach.id)
    .maybeSingle()

  if (!lesson) return { ok: false, error: 'Урок не найден или нет прав на изменение' }

  // Ставить расписание на пустой урок нельзя — то же правило, что у публикации
  if (when) {
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
      return { ok: false, error: 'Сначала заполните и сохраните контент урока — публиковать пустой урок нельзя' }
    }
  }

  const { data, error: updateError } = await supabase
    .from('lessons')
    .update({
      publish_at: publishAt,
      // Установка расписания на опубликованном уроке: сразу снимаем с публикации
      // (published_at тоже сбрасываем — фактической публикации пока нет).
      // Отмена расписания (publishAt = null) статус не меняет.
      ...(lesson.is_published && publishAt ? { is_published: false, published_at: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId)
    .eq('coach_id', coach.id)
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
    content_html?: string | null
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

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
  //
  // Текстовый урок: HTML от клиента НЕ доверяем — очищаем на сервере через
  // схему Tiptap (lib/editor/sanitizeLessonHtml.ts): script/onclick/javascript:
  // отбрасываются, остаётся только разметка редактора. content_url для текста
  // пустой (колонка NOT NULL — пишем '').
  let contentUrl = content.content_url
  let contentHtml: string | null = null
  if (content.content_type === 'text') {
    contentHtml = sanitizeLessonHtml(content.content_html || '')
    if (!contentHtml) return { ok: false, error: 'Текст урока пуст — напишите хотя бы один абзац' }
    contentUrl = ''
  }

  const { data: existingContent } = await supabase
    .from('lesson_content')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  let contentError
  if (existingContent) {
    const { error } = await supabase
      .from('lesson_content')
      .update({
        content_type: content.content_type,
        content_url: contentUrl,
        title: content.title,
        content_html: contentHtml,
      })
      .eq('id', existingContent.id)
    contentError = error
  } else {
    const { error } = await supabase
      .from('lesson_content')
      .insert({
        lesson_id: lessonId,
        content_type: content.content_type,
        content_url: contentUrl,
        title: content.title,
        content_html: contentHtml,
        order_index: 0,
      })
    contentError = error
  }

  if (contentError) return { ok: false, error: contentError.message }
  return { ok: true }
}