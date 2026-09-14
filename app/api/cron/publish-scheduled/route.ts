import { createAdminClient } from '@/lib/supabase/admin'

// Публикация отложенных постов в соцсети (бэклог №20 «Отложенные посты»).
// Забирает из очереди scheduled_posts посты со сроком <= сейчас и публикует
// их в Telegram: серверы Vercel вне РФ, поэтому VPN не нужен (из РФ
// api.telegram.org недоступен — причина всей очереди).
//
// Запуск (два независимых триггера, защита от дублей — атомарный «захват»
// строк: обновляем только ещё pending, второй вызов получает 0 строк):
//   1. pg_cron + pg_net — POST каждые 15 минут (миграция 2026-09-13) с
//      заголовком x-cron-secret;
//   2. Vercel Cron раз в сутки (vercel.json) — резервный догон, GET с
//      Authorization: Bearer (Vercel сам подставляет CRON_SECRET).
//
// Переменные окружения (настраиваются в Vercel → Settings → Environment Variables):
//   CRON_SECRET   — секрет триггера (тот же вписан в pg_cron-задачу)
//   TG_BOT_TOKEN  — токен бота Telegram (сейчас — из agent/config.json, tg_bot_token)
//   TG_CHANNEL_ID — канал (по умолчанию @rightway_platform)
//
// Ошибки публикации: 3 попытки (attempts), дальше статус failed. Пока
// TG_BOT_TOKEN не настроен, посты остаются pending — опубликуются после настройки.

const MAX_ATTEMPTS = 3
const CLAIM_BATCH = 10 // за раз берём не больше — успеть в лимиты функции

function unauthorized() {
  return Response.json({ error: 'Не авторизован' }, { status: 401 })
}

async function tgApi(method: string, payload: Record<string, unknown>) {
  const token = process.env.TG_BOT_TOKEN
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string; result?: { message_id?: number } } | null
  if (!data?.ok) {
    throw new Error(data?.description || `Telegram ответил ${res.status}`)
  }
  return data
}

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'CRON_SECRET не настроен на сервере' }, { status: 503 })

  const bearer = request.headers.get('authorization')
  const provided =
    request.headers.get('x-cron-secret') ||
    (bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : null)
  if (provided !== secret) return unauthorized()

  const admin = createAdminClient()
  if (!admin) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' }, { status: 503 })

  if (!process.env.TG_BOT_TOKEN) {
    // Окружение не готово — очередь не трогаем, посты подождут настройки
    return Response.json({ ok: false, skipped: 'TG_BOT_TOKEN не настроен' }, { status: 503 })
  }
  const channelId = process.env.TG_CHANNEL_ID || '@rightway_platform'

  // 1. Атомарный захват: только pending и подошедшие по сроку. Если два
  // триггера сработали одновременно, второй увидит 0 строк по этим id.
  const { data: due } = await admin
    .from('scheduled_posts')
    .select('id')
    .eq('status', 'pending')
    .lte('publish_at', new Date().toISOString())
    .order('publish_at', { ascending: true })
    .limit(CLAIM_BATCH)

  if (!due || due.length === 0) {
    return Response.json({ ok: true, processed: 0 })
  }

  const { data: claimed, error: claimError } = await admin
    .from('scheduled_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .in('id', due.map((p) => p.id))
    .eq('status', 'pending')
    .select('id, channel, text, photo_url, attempts')

  if (claimError) return Response.json({ error: claimError.message }, { status: 500 })

  // 2. Публикуем каждый захваченный пост
  let published = 0
  let failed = 0
  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const post of claimed || []) {
    try {
      if (post.channel !== 'tg') {
        throw new Error(`Канал «${post.channel}» пока не поддерживается`)
      }

      let messageId: number | undefined
      if (post.photo_url) {
        const resp = await tgApi('sendPhoto', {
          chat_id: channelId,
          photo: post.photo_url, // публичный URL — Telegram скачает сам
          caption: post.text.slice(0, 1024), // лимит подписи к фото
        })
        messageId = resp.result?.message_id
      } else {
        const resp = await tgApi('sendMessage', {
          chat_id: channelId,
          text: post.text.slice(0, 4096), // лимит сообщения
        })
        messageId = resp.result?.message_id
      }

      await admin
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_message_id: messageId ?? null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
      published += 1
      results.push({ id: post.id, ok: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const attempts = (post.attempts ?? 0) + 1
      const giveUp = attempts >= MAX_ATTEMPTS
      await admin
        .from('scheduled_posts')
        .update({
          status: giveUp ? 'failed' : 'pending', // не исчерпаны — попробуем на следующем тике
          attempts,
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
      if (giveUp) failed += 1
      results.push({ id: post.id, ok: false, error: message })
    }
  }

  return Response.json({ ok: true, processed: claimed?.length ?? 0, published, failed, results })
}