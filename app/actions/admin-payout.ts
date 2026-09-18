'use server'

// Админская сторона кошелька (2026-09-17): обработка заявок на вывод.
// Оферта п. 6.5: выплата вручную с р/с ООО, решение только за админом.
// «Выплачено» требует номер чека «Мой налог» (для учёта), отказ — причину
// (её увидит автор в кабинете). Все решения пишутся в audit_log.
//
// Паттерн тот же, что в admin-partner.ts: админский токен + RLS-гвард
// (payouts_admin_select/update), аудит, уведомления сервисным ключом.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type AdminActionResult = { ok: boolean; error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AdminGuard = { ok: true; supabase: any; adminId: string } | { ok: false; error: string }

async function requireAdmin(): Promise<AdminGuard> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }
  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (coach?.role !== 'admin') return { ok: false, error: 'Недостаточно прав' }
  return { ok: true, supabase, adminId: user.id }
}

// Обработать заявку: decision 'paid' (номер чека «Мой налог» необязателен —
// автор прикладывает его сам в кабинете, до этого его вывод заблокирован)
// или 'rejected' (обязательна причина, её увидит автор).
export async function processPayout(
  requestId: string,
  decision: 'paid' | 'rejected',
  receiptNumber: string,
  reason: string
): Promise<AdminActionResult> {
  if (!UUID_RE.test(requestId)) return { ok: false, error: 'Некорректный запрос' }

  const receipt = receiptNumber.trim()
  const trimmedReason = reason.trim()
  if (decision === 'paid' && receipt && receipt.length < 3) {
    return { ok: false, error: 'Номер чека — от 3 символов (или оставьте поле пустым)' }
  }
  if (decision === 'rejected' && trimmedReason.length < 5) {
    return { ok: false, error: 'Укажите причину отказа (от 5 символов)' }
  }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { data: req } = await supabase
    .from('payout_requests')
    .select('id, coach_user_id, amount, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!req) return { ok: false, error: 'Заявка не найдена' }
  if (req.status !== 'pending') return { ok: false, error: 'Заявка уже обработана' }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('payout_requests')
    .update({
      status: decision,
      receipt_number: decision === 'paid' && receipt ? receipt : null, // пусто → NULL, не ''
      admin_note: decision === 'rejected' ? trimmedReason : null,
      processed_at: now,
      processed_by: adminId,
    })
    .eq('id', requestId)
    .eq('status', 'pending') // защита от гонки: повторно не трогаем
  if (error) return { ok: false, error: 'Не удалось обработать заявку' }

  await supabase.from('audit_log').insert({
    actor_user_id: adminId,
    action: decision === 'paid' ? 'payout_paid' : 'payout_rejected',
    entity: 'payout_requests',
    entity_id: requestId,
    details: {
      coach_user_id: req.coach_user_id,
      amount: Number(req.amount),
      receipt_number: decision === 'paid' && receipt ? receipt : null,
      reason: decision === 'rejected' ? trimmedReason : null,
    },
  })

  // Уведомление автору о решении (INSERT-политики у notifications нет).
  const admin = createAdminClient()
  if (admin) {
    const amount = Number(req.amount).toLocaleString('ru-RU')
    await admin.from('notifications').insert({
      user_id: req.coach_user_id,
      type: 'payout',
      title: decision === 'paid' ? 'Выплата проведена' : 'Заявка на вывод отклонена',
      message:
        decision === 'paid'
          ? receipt
            ? `Выплата ${amount} ₽ проведена. Чек «Мой налог» № ${receipt} — в разделе «Партнёрская программа».`
            : `Выплата ${amount} ₽ проведена. Приложите номер чека «Мой налог» в разделе «Партнёрская программа» — без него следующая заявка на вывод будет недоступна.`
          : `Заявка на ${amount} ₽ отклонена. Причина: ${trimmedReason}. Средства остаются в кошельке — заявить вывод можно снова в любой момент.`,
      link: '/dashboard/mentor/partner',
      is_read: false,
    })
  }

  revalidatePath('/admin/payouts')
  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}

// Вписать чек вручную — если автор прислал номер в мессенджер и не приложил
// сам. Только для paid-заявки без чека; автору уведомление не нужно (чек
// виден ему в кабинете сразу).
export async function setReceiptNumber(
  requestId: string,
  receiptNumber: string
): Promise<AdminActionResult> {
  if (!UUID_RE.test(requestId)) return { ok: false, error: 'Некорректный запрос' }
  const receipt = receiptNumber.trim()
  if (receipt.length < 3 || receipt.length > 50) {
    return { ok: false, error: 'Номер чека — от 3 до 50 символов' }
  }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { data: updated, error } = await supabase
    .from('payout_requests')
    .update({ receipt_number: receipt })
    .eq('id', requestId)
    .eq('status', 'paid')
    // NULL или пустая строка (наследие старого шага «Выплачено»)
    .or('receipt_number.is.null,receipt_number.eq.""')
    .select('id, coach_user_id')
  if (error || !updated || updated.length === 0) {
    return { ok: false, error: 'Заявка не найдена или чек уже приложен' }
  }

  await supabase.from('audit_log').insert({
    actor_user_id: adminId,
    action: 'payout_receipt_attached',
    entity: 'payout_requests',
    entity_id: requestId,
    details: { receipt_number: receipt, entered_by: 'admin' },
  })

  revalidatePath('/admin/payouts')
  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}

// Доступный баланс автора — админу для сверки при обработке заявки
// (сумма заявки не должна превышать начисленное минус прочие заявки).
// Та же формула, что у ментора (payout.ts), но для произвольного автора.
// excludeRequestId — обрабатываемая заявка: её сумма ещё не списана,
// поэтому из резерва её исключаем (иначе ложное «меньше суммы заявки»).
export async function getCoachAvailable(
  coachUserId: string,
  excludeRequestId?: string
): Promise<number> {
  const g = await requireAdmin()
  if (!g.ok) return 0
  const { supabase } = g

  let earned = 0
  // lessons.coach_id / courses.coach_id ссылаются на coaches.id (профиль),
  // а не на auth-user id — находим профиль по user_id.
  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', coachUserId)
    .maybeSingle()
  if (!coachRow) return 0
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('coach_id', coachRow.id)
  const { data: courses } = await supabase
    .from('courses')
    .select('id')
    .eq('coach_id', coachRow.id)
  const lessonIds = (lessons || []).map((l: { id: string }) => l.id)
  const courseIds = (courses || []).map((c: { id: string }) => c.id)

  // Уникальные покупки: одна может покрыть и урок, и курс автора.
  const earningsByPurchase = new Map<string, number>()
  const collect = async (field: 'lesson_id' | 'course_id', ids: string[]) => {
    if (ids.length === 0) return
    const { data: rows } = await supabase
      .from('purchases')
      .select('id, coach_earnings')
      .eq('payment_status', 'completed')
      .in(field, ids)
    for (const r of rows || []) earningsByPurchase.set(r.id, Number(r.coach_earnings ?? 0))
  }
  await collect('lesson_id', lessonIds)
  await collect('course_id', courseIds)
  for (const v of earningsByPurchase.values()) earned += v

  const { data: subRows } = await supabase
    .from('subscription_payments')
    .select('coach_earnings')
    .eq('coach_user_id', coachUserId)
    .eq('status', 'completed')
  for (const r of subRows || []) earned += Number(r.coach_earnings ?? 0)

  const { data: payoutRows } = await supabase
    .from('payout_requests')
    .select('id, amount, status')
    .eq('coach_user_id', coachUserId)
  let reserved = 0
  for (const r of payoutRows || []) {
    if (r.id === excludeRequestId) continue
    if (r.status === 'paid' || r.status === 'pending') reserved += Number(r.amount)
  }

  return Math.round((earned - reserved) * 100) / 100
}