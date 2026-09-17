'use server'

// №32 бэклога (2026-09-17): реферальная программа авторов — реализация п. 5.4
// оферты v1.2. Автор зовёт пользователей по персональной ссылке
// https://<домен>/?ref=<coach_user_id>; каждый новый пользователь продлевает
// активный бенефит (−5 п.п.) на 1 месяц (первый даёт 1 месяц, второй — 2 и т.д.).
// Расчёт комиссии применяет бенефиты: lib/commission.ts.
//
// Схема: commission_benefits (миграция Ф1 2026-09-10) — рамка бенефитов;
// referral_registrations (миграция 2026-09-17) — кто кого привёл (1 к 1).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ReferralSummary = {
  link: string | null
  referredCount: number
  /** Активная суммарная скидка, п.п. (0 = не действует). */
  discountPp: number
  /** До какого числа действует активный бенефит (null = не действует). */
  activeUntil: string | null
}

/** IP клиента для антифрода (спека payments.md) — best effort, inet-валидацию делает БД. */
async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers()
    const first = h.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(first) ? first : null
  } catch {
    return null
  }
}

/** Размер реферального бенефита из настроек (fallback 5 п.п. — как в оферте). */
async function getDiscountPp(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<number> {
  const { data } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'referral_discount_pp')
    .maybeSingle()
  const pp = Number(data?.value?.pp)
  return Number.isFinite(pp) && pp > 0 && pp <= 50 ? pp : 5
}

/**
 * Зафиксировать приведённого пользователя. Вызывается со страницы регистрации
 * после signUp: код читается из localStorage (класть его туда умеет RefCapture).
 * Повторный вызов (уже есть запись) и код без автора — тихое ok, чтобы не
 * ломать регистрацию.
 */
/**
 * Зафиксировать приведённого пользователя. Вызывается со страницы регистрации
 * после signUp: код читается из localStorage (класть его туда умеет RefCapture).
 * newUserId — id из ответа signUp: при включённом подтверждении e-mail сессии
 * ещё нет, поэтому идентификатор передаётся явно (серверно проверяется).
 * Повторный вызов (уже есть запись) и код без автора — тихое ok, чтобы не
 * ломать регистрацию.
 */
export async function saveReferral(
  code: string,
  newUserId?: string
): Promise<{ ok: boolean; error?: string }> {
  const codeClean = String(code || '').trim()
  if (!UUID_RE.test(codeClean)) return { ok: false }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Сервис недоступен' }

  // Приведённый пользователь: обычно есть сессия (подтверждение e-mail
  // выключено). Если включено — сессии нет, но signUp вернул id: принимаем
  // его только если аккаунт создан только что (окно 15 минут — нельзя
  // атрибутировать давно существующий аккаунт).
  let referredId: string | null = user?.id ?? null
  if (!referredId && newUserId && UUID_RE.test(newUserId)) {
    // Схема auth не экспонирована через PostgREST — проверяем через GoTrue API.
    const { data: fresh } = await admin.auth.admin.getUserById(newUserId)
    const createdAt = fresh?.user ? new Date(fresh.user.created_at).getTime() : 0
    if (fresh?.user && Date.now() - createdAt < 15 * 60 * 1000) {
      referredId = fresh.user.id
    }
  }
  if (!referredId) return { ok: false } // нет сессии и нет валидного свежего id

  // Приведённый пользователь не может быть самим автором.
  if (referredId === codeClean) return { ok: false }

  // Автор существует и не админ (админ — не участник реферальной программы).
  const { data: coach } = await admin
    .from('coaches')
    .select('user_id, display_name')
    .eq('user_id', codeClean)
    .neq('role', 'admin')
    .maybeSingle()
  if (!coach) return { ok: false }

  // Одна реферальная запись на пользователя (UNIQUE referred_user_id).
  const { data: existing } = await admin
    .from('referral_registrations')
    .select('id')
    .eq('referred_user_id', referredId)
    .maybeSingle()
  if (existing) return { ok: true }

  const ip = await getClientIp()
  const inserted = await admin
    .from('referral_registrations')
    .insert({ coach_user_id: coach.user_id, referred_user_id: referredId, ip })
  if (inserted.error) {
    // UNIQUE-гонка (двойной сабмит) — считаем успехом, запись уже есть.
    if (inserted.error.message.includes('duplicate') || inserted.error.message.includes('unique')) {
      return { ok: true }
    }
    return { ok: false, error: inserted.error.message }
  }

  // Бенефит: первый реферал — 1 месяц, каждый следующий продлевает на 1 месяц
  // (срок копится от последнего продления: «суммарно на 2 месяца» п. 5.4).
  const pp = await getDiscountPp(admin)
  const now = new Date()
  const { data: current } = await admin
    .from('commission_benefits')
    .select('id, expires_at')
    .eq('coach_user_id', coach.user_id)
    .eq('source', 'referral')
    .is('revoked_at', null)
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const base = current?.expires_at && new Date(current.expires_at) > now ? new Date(current.expires_at) : now
  const expires = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

  if (current) {
    await admin
      .from('commission_benefits')
      .update({ expires_at: expires.toISOString(), note: `Рефералов: продлено ${now.toISOString().slice(0, 10)}` })
      .eq('id', current.id)
  } else {
    await admin.from('commission_benefits').insert({
      coach_user_id: coach.user_id,
      discount_pp: pp,
      source: 'referral',
      note: `Первый реферал ${now.toISOString().slice(0, 10)}`,
      granted_at: now.toISOString(),
      expires_at: expires.toISOString(),
    })
  }

  // Уведомление автору (тип 'referral' добавлен миграцией 2026-09-17).
  await admin.from('notifications').insert({
    user_id: coach.user_id,
    type: 'referral',
    title: 'Новый пользователь по вашей ссылке',
    message: `По вашей реферальной ссылке зарегистрировался новый пользователь. Бенефит −${pp} п.п. продлён до ${expires.toLocaleDateString('ru-RU')} (п. 5.4 оферты).`,
    link: '/dashboard/mentor/partner',
    is_read: false,
  })

  return { ok: true }
}