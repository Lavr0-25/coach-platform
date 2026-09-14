import { getAgentClient } from '@/lib/agentAuth'
import { findBannedWord } from '@/lib/bannedWords'
import type { SupabaseClient } from '@supabase/supabase-js'

// Агентское API: очередь постов в соцсети (бэклог №20 «Отложенные посты»).
// Контент-завод вместо прямой отправки в Telegram (недоступен из РФ без VPN)
// кладёт пост в очередь scheduled_posts; Vercel-функция
// /api/cron/publish-scheduled (запуск: pg_cron + pg_net каждые 15 минут и
// резервный дневной Vercel Cron) публикует её в срок — серверы Vercel вне РФ.
//
// POST   /api/agent/scheduled-posts — поставить пост в очередь:
//          { text, publish_at, photo_base64?, photo_ext? }
//          Фото (если есть) загружается в публичный бакет covers.
// GET    /api/agent/scheduled-posts — свои посты (последние 50, свежие сверху).
// PATCH  /api/agent/scheduled-posts — отменить свой пост в очереди: { id, cancel: true }
//
// Ворота качества (как у уроков, см. app/api/agent/lessons/route.ts):
//   1. Запрещённые слова (banned_words) — общий модуль lib/bannedWords.ts
//   2. Лимит: не больше MAX_POSTS_PER_DAY постов в день на автора
// Ограничения Telegram: с фото подпись не длиннее TG_CAPTION_LIMIT (1024),
// без фото — TG_TEXT_LIMIT (4096). Не прошедшие ворота посты НЕ ставятся
// в очередь (в отличие от уроков: пост уйдёт в публичный канал без человека).
//
// Доступ: x-agent-key (lib/agentAuth.ts), клиент = сессия владельца ключа,
// RLS не даёт агенту трогать чужие посты.

const MAX_POSTS_PER_DAY = 5
const TG_CAPTION_LIMIT = 1024
const TG_TEXT_LIMIT = 4096
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // лимит бакета covers
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'] // разрешены и политикой бакета

async function getCoachId(client: SupabaseClient, userId: string) {
  const { data: coach } = await client.from('coaches').select('id').eq('user_id', userId).maybeSingle()
  return coach?.id ?? null
}

export async function POST(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const coachId = await getCoachId(auth.client, auth.userId)
  if (!coachId) return Response.json({ error: 'Профиль автора не найден' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const text = (body?.text as string | undefined)?.trim() || ''
  if (!text) return Response.json({ error: 'Нужно поле text — текст поста' }, { status: 400 })

  // Дата: строго в будущем (немедленно = поставьте publish_at на пару минут вперёд)
  const publishAtRaw = (body?.publish_at as string | undefined)?.trim() || ''
  const publishAt = new Date(publishAtRaw)
  if (!publishAtRaw || isNaN(publishAt.getTime())) {
    return Response.json(
      { error: 'Нужен publish_at — ISO-дата (например 2026-09-14T10:00:00+03:00)' },
      { status: 422 }
    )
  }
  if (publishAt.getTime() <= Date.now()) {
    return Response.json({ error: 'publish_at должен быть в будущем' }, { status: 422 })
  }

  // Ограничения Telegram по длине — проверяем сразу, чтобы пост не «застрял»
  const photoBase64 = (body?.photo_base64 as string | undefined)?.trim() || ''
  const photoExt = (body?.photo_ext as string | undefined)?.trim().toLowerCase() || ''
  const limit = photoBase64 ? TG_CAPTION_LIMIT : TG_TEXT_LIMIT
  if (text.length > limit) {
    return Response.json(
      { error: `Текст слишком длинный: ${text.length} символов, максимум ${limit} ${photoBase64 ? 'для поста с фото' : 'для поста без фото'}` },
      { status: 422 }
    )
  }

  // Ворота 1: запрещённые слова
  const banned = await findBannedWord(auth.client, [text])
  if (banned) {
    return Response.json(
      { error: `Найдено запрещённое слово: «${banned}» — пост в очередь не поставлен` },
      { status: 422 }
    )
  }

  // Ворота 2: дневной лимит
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const { count } = await auth.client
    .from('scheduled_posts')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .gte('created_at', startOfDay.toISOString())
  if ((count ?? 0) >= MAX_POSTS_PER_DAY) {
    return Response.json(
      { error: `Достигнут дневной лимит постов (${MAX_POSTS_PER_DAY} в день) — продолжите завтра` },
      { status: 429 }
    )
  }

  // Фото: base64 → публичный бакет covers (его URL потом заберёт Telegram)
  let photoUrl: string | null = null
  if (photoBase64) {
    if (!PHOTO_EXTS.includes(photoExt)) {
      return Response.json(
        { error: `photo_ext должен быть одним из: ${PHOTO_EXTS.join(', ')}` },
        { status: 422 }
      )
    }
    const buffer = Buffer.from(photoBase64, 'base64')
    if (buffer.length === 0) return Response.json({ error: 'photo_base64 пуст или не распознан' }, { status: 422 })
    if (buffer.length > MAX_PHOTO_BYTES) {
      return Response.json(
        { error: `Фото слишком большое: ${Math.round(buffer.length / 1024)} КБ, максимум ${MAX_PHOTO_BYTES / (1024 * 1024)} МБ` },
        { status: 422 }
      )
    }
    const path = `posts/${coachId}/${Date.now()}.${photoExt}`
    const { error: uploadError } = await auth.client.storage
      .from('covers')
      .upload(path, buffer, { contentType: photoExt === 'jpg' ? 'image/jpeg' : `image/${photoExt}` })
    if (uploadError) return Response.json({ error: `Фото не загружено: ${uploadError.message}` }, { status: 500 })

    const { data: pub } = auth.client.storage.from('covers').getPublicUrl(path)
    photoUrl = pub.publicUrl
  }

  const { data: post, error: insertError } = await auth.client
    .from('scheduled_posts')
    .insert({
      coach_id: coachId,
      channel: 'tg', // VK и другие сети — позже (бэклог №21)
      text,
      photo_url: photoUrl,
      status: 'pending',
      publish_at: publishAt.toISOString(),
    })
    .select('id, channel, status, publish_at, photo_url, created_at')
    .single()

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

  return Response.json(
    {
      ok: true,
      post,
      scheduled: true,
      note: 'Пост в очереди; опубликуется по расписанию (проверка очереди каждые 15 минут)',
    },
    { status: 201 }
  )
}

export async function GET(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const coachId = await getCoachId(auth.client, auth.userId)
  if (!coachId) return Response.json({ error: 'Профиль автора не найден' }, { status: 404 })

  const { data: posts, error } = await auth.client
    .from('scheduled_posts')
    .select('id, channel, status, text, photo_url, publish_at, published_at, attempts, error, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, posts })
}

// PATCH — отменить свой пост, пока он в очереди: { id, cancel: true }
export async function PATCH(request: Request) {
  const auth = await getAgentClient(request)
  if ('error' in auth) return auth.error

  const coachId = await getCoachId(auth.client, auth.userId)
  if (!coachId) return Response.json({ error: 'Профиль автора не найден' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const id = body?.id as string | undefined
  if (!id) return Response.json({ error: 'Нужно поле id' }, { status: 400 })
  if (body?.cancel !== true) {
    return Response.json({ error: 'Поддерживается только { id, cancel: true }' }, { status: 400 })
  }

  const { data: post, error } = await auth.client
    .from('scheduled_posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', coachId)
    .eq('status', 'pending') // отменять можно только неопубликованные
    .select('id, status')
    .single()

  if (error || !post) return Response.json({ error: 'Пост не найден среди неопубликованных' }, { status: 404 })
  return Response.json({ ok: true, post })
}