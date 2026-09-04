import { getAgentClient } from '@/lib/agentAuth'
import { sanitizeLessonHtml } from '@/lib/editor/sanitizeLessonHtml'
import type { SupabaseClient } from '@supabase/supabase-js'

// Агентское API: текстовые уроки — вторая половина «ИИ-завода контента».
// POST  /api/agent/lessons — создать черновик текстового урока:
//         { topic_id?, title, description?, html, publish_at? }
//         publish_at (ISO, строго в будущем) = отложенная публикация: черновик
//         создан, pg_cron откроет его в срок (миграция 2026-09-03). Тема при
//         этом сразу помечается published — тема обработана, лимит дня учтён.
// PATCH /api/agent/lessons — опубликовать черновик немедленно: { id, publish: true }
//
// Ворота качества (автопубликация без человека — проверяем на сервере):
//   1. HTML очищается через схему Tiptap (XSS-защита, lib/editor/sanitizeLessonHtml)
//   2. Минимальный объём осмысленного текста (MIN_CONTENT_CHARS символов вне тегов)
//   3. Запрещённые слова (banned_words) — в заголовке, описании и тексте
//   4. Лимит автопубликаций: не больше MAX_PUBLISH_PER_DAY в день на автора
//      (считаем и немедленные публикации, и запланированные)
// Ворота 2-3 проверяются и на черновике, и повторно на публикации: черновик мог
// быть написан давно, а слова в стоп-листе могли появиться позже.
// Не прошедший ворота урок остаётся ЧЕРНОВИКОМ — автор доработает его в кабинете.
//
// Доступ: x-agent-key (lib/agentAuth.ts), клиент = сессия владельца ключа,
// RLS не даёт агенту трогать чужие уроки. Урок создаётся от имени автора.

const MIN_CONTENT_CHARS = 2000
const MAX_PUBLISH_PER_DAY = 3

function stripTags(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Проверка запрещённых слов по всем текстовым полям урока
async function findBannedWord(
  client: SupabaseClient,
  texts: (string | null | undefined)[]
): Promise<string | null> {
  const { data: words, error } = await client.from('banned_words').select('word')
  if (error) return null // список недоступен — не блокируем (ошибку покажет отдельный вызов)
  const haystack = texts.filter(Boolean).join(' ').toLowerCase()
  for (const { word } of words || []) {
    if (word && haystack.includes(word.toLowerCase())) return word
  }
  return null
}

async function getCoachId(client: SupabaseClient, userId: string) {
  const { data: coach } = await client.from('coaches').select('id').eq('user_id', userId).maybeSingle()
  return coach?.id ?? null
}

// POST — создать черновик. Ворота объёма/слов: при провале черновик всё равно
// создаётся (автор увидит и доработает), но в ответе будет published: false + reason.
export async function POST(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const coachId = await getCoachId(auth.client, auth.userId)
  if (!coachId) return Response.json({ error: 'Профиль автора не найден' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const title = (body?.title as string | undefined)?.trim() || ''
  const description = (body?.description as string | undefined)?.trim() || ''
  const html = (body?.html as string | undefined)?.trim() || ''
  const topicId = (body?.topic_id as string | undefined)?.trim() || null

  // Отложенная публикация: валидируем до создания черновика (мусора не оставляем)
  const publishAtRaw = (body?.publish_at as string | undefined)?.trim() || null
  let publishAt: string | null = null
  if (publishAtRaw) {
    const date = new Date(publishAtRaw)
    if (isNaN(date.getTime())) {
      return Response.json(
        { error: 'publish_at не распознан как дата — нужен ISO-формат (например 2026-09-05T08:00:00+03:00)' },
        { status: 422 }
      )
    }
    if (date.getTime() <= Date.now()) {
      return Response.json(
        { error: 'publish_at должен быть в будущем (публиковать немедленно — используйте PATCH { id, publish: true })' },
        { status: 422 }
      )
    }
    publishAt = date.toISOString()
  }

  if (!title) return Response.json({ error: 'Нужно поле title' }, { status: 400 })
  if (!html) return Response.json({ error: 'Нужно поле html — текст урока (Tiptap HTML)' }, { status: 400 })

  // Ворота 1: очистка HTML от всего, чего нет в схеме редактора
  const cleanHtml = sanitizeLessonHtml(html)
  if (!cleanHtml) {
    return Response.json(
      { error: 'html пуст или не распознан как разметка редактора — урок не создан' },
      { status: 422 }
    )
  }

  const text = stripTags(cleanHtml)
  const reasons: string[] = []

  // Ворота 2: минимальный объём
  if (text.length < MIN_CONTENT_CHARS) {
    reasons.push(`Текст слишком короткий: ${text.length} символов, минимум ${MIN_CONTENT_CHARS}`)
  }

  // Ворота 3: запрещённые слова
  const banned = await findBannedWord(auth.client, [title, description, cleanHtml])
  if (banned) reasons.push(`Найдено запрещённое слово: «${banned}»`)

  if (reasons.length > 0) {
    return Response.json(
      { error: `Урок не готов к публикации. ${reasons.join('. ')}`, next: 'исправьте и повторите POST, либо доработайте черновик вручную' },
      { status: 422 }
    )
  }

  // Ворота 4 при отложенной публикации: запланированный урок тоже расходует
  // дневной лимит (иначе агент сможет запланировать хоть десять за раз)
  if (publishAt) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const { count } = await auth.client
      .from('lesson_topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('updated_at', startOfDay.toISOString())
    if ((count ?? 0) >= MAX_PUBLISH_PER_DAY) {
      return Response.json(
        { error: `Достигнут дневной лимит автопубликаций (${MAX_PUBLISH_PER_DAY} в день) — продолжите завтра` },
        { status: 429 }
      )
    }
  }

  // Черновик: is_published=false, цена 0 (автоконтент бесплатный, цену ставит автор).
  // publish_at — отложенная публикация, pg_cron откроет урок в срок.
  const { data: lesson, error: lessonError } = await auth.client
    .from('lessons')
    .insert({
      module_id: null,
      coach_id: coachId,
      title,
      description: description || null,
      price: 0,
      is_free_preview: false,
      cover_image: null,
      order_index: 1,
      is_published: false,
      publish_at: publishAt,
    })
    .select('id, title, is_published, publish_at, created_at')
    .single()

  if (lessonError) return Response.json({ error: lessonError.message }, { status: 500 })

  const { error: contentError } = await auth.client.from('lesson_content').insert({
    lesson_id: lesson.id,
    content_type: 'text',
    content_url: '',
    title: null,
    content_html: cleanHtml,
    order_index: 0,
  })

  if (contentError) {
    // Урок без контента — мусор; откатываем создание черновика
    await auth.client.from('lessons').delete().eq('id', lesson.id)
    return Response.json({ error: contentError.message }, { status: 500 })
  }

  // Тема указана → привязываем урок. Черновик без расписания — тема в работе;
  // запланирован publish_at — тема обработана (published), лимит дня уже учтён.
  if (topicId) {
    const { error } = await auth.client
      .from('lesson_topics')
      .update({
        lesson_id: lesson.id,
        status: publishAt ? 'published' : 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', topicId)
    if (error) {
      // Черновик создан, но тема не пометилась — сообщим, агент может повторить PATCH
      return Response.json({ ok: true, lesson, warning: `Черновик создан, но тема не обновлена: ${error.message}` }, { status: 201 })
    }
  }

  return Response.json(
    publishAt
      ? { ok: true, lesson, published: false, scheduled: true }
      : { ok: true, lesson, published: false },
    { status: 201 }
  )
}

// PATCH — опубликовать черновик { id, publish: true }. Повторные ворота + дневной лимит.
export async function PATCH(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const coachId = await getCoachId(auth.client, auth.userId)
  if (!coachId) return Response.json({ error: 'Профиль автора не найден' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const id = body?.id as string | undefined
  if (!id) return Response.json({ error: 'Нужно поле id' }, { status: 400 })
  if (body?.publish !== true) {
    return Response.json({ error: 'Поддерживается только { id, publish: true }' }, { status: 400 })
  }

  // Свой черновик с текстовым контентом (RLS: чужой не найдётся)
  const { data: lesson } = await auth.client
    .from('lessons')
    .select('id, title, is_published')
    .eq('id', id)
    .eq('coach_id', coachId)
    .maybeSingle()
  if (!lesson) return Response.json({ error: 'Урок не найден' }, { status: 404 })
  if (lesson.is_published) return Response.json({ ok: true, lesson, published: true })

  const { data: content } = await auth.client
    .from('lesson_content')
    .select('content_type, content_html')
    .eq('lesson_id', id)
    .limit(1)
    .maybeSingle()
  if (!content || content.content_type !== 'text') {
    return Response.json({ error: 'Публиковать можно только текстовые уроки агента' }, { status: 422 })
  }

  const cleanHtml = sanitizeLessonHtml(content.content_html || '')
  const text = stripTags(cleanHtml)
  const reasons: string[] = []
  if (!cleanHtml || text.length < MIN_CONTENT_CHARS) {
    reasons.push(`Текст слишком короткий: ${text.length} символов, минимум ${MIN_CONTENT_CHARS}`)
  }
  const banned = await findBannedWord(auth.client, [lesson.title, cleanHtml])
  if (banned) reasons.push(`Найдено запрещённое слово: «${banned}»`)
  if (reasons.length > 0) {
    return Response.json({ error: `Публикация отклонена. ${reasons.join('. ')}` }, { status: 422 })
  }

  // Ворота 4: дневной лимит автопубликаций — по темам, опубликованным агентом сегодня
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const { count } = await auth.client
    .from('lesson_topics')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('updated_at', startOfDay.toISOString())
  if ((count ?? 0) >= MAX_PUBLISH_PER_DAY) {
    return Response.json(
      { error: `Достигнут дневной лимит автопубликаций (${MAX_PUBLISH_PER_DAY} в день) — продолжите завтра` },
      { status: 429 }
    )
  }

  const { data: published, error } = await auth.client
    .from('lessons')
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', coachId)
    .select('id, title, is_published')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Тема, привязанная к этому уроку → «Опубликован»
  await auth.client
    .from('lesson_topics')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('lesson_id', id)

  return Response.json({ ok: true, lesson: published, published: true })
}