'use server'

// Кошелёк ментора (2026-09-17): доступный баланс и заявки на вывод.
// Оферта п. 6.5: вывод от 1 000 ₽, минимум для вывода фиксирует и БД
// (CHECK amount >= 1000 в payout_requests). Выплата — вручную с р/с ООО
// по заявке (не автоперевод), решение только за админом (admin-payout.ts).
//
// Баланс = completed-роялти (фиксируется в момент покупки в coach_earnings:
// purchases по материалам ментора + subscription_payments по coach_user_id)
// минус оплаченные и ожидающие заявки на вывод.
//
// Менторский клиент под своим токеном: RLS payout_requests разрешает SELECT
// и INSERT только своих строк; реквизиты и материал — свои же.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
// Константы и типы — в lib/payout: у 'use server'-модуля экспортом может быть
// только async-функция (см. комментарий там).
import { MIN_PAYOUT_RUB } from '@/lib/payout'
import type { WalletSummary, UnreceiptedPayout } from '@/lib/payout'

export type PayoutActionResult = { ok: boolean; error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Сводка кошелька. purchases не имеют колонки автора — автор определяется
// по материалам ментора (как в аналитике): собираем id его уроков и курсов,
// затем суммируем completed-роялти по ним.
export async function getWalletSummary(): Promise<
  { ok: true; wallet: WalletSummary } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  // Материалы ментора (paid-уроки возможны только с рубильником, но
  // кошелёк считаем всем накопленным — и до включения продаж тоже).
  // Внимание: lessons.coach_id / courses.coach_id ссылаются на coaches.id
  // (профиль), а не на auth-user id — сначала находим свой профиль.
  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  const { data: lessons } = coachRow
    ? await supabase.from('lessons').select('id').eq('coach_id', coachRow.id)
    : { data: [] }
  const { data: courses } = coachRow
    ? await supabase.from('courses').select('id').eq('coach_id', coachRow.id)
    : { data: [] }
  const lessonIds = (lessons || []).map((l: { id: string }) => l.id)
  const courseIds = (courses || []).map((c: { id: string }) => c.id)

  // Роялти покупок: покупка может покрыть и урок, и курс ментора одновременно,
  // поэтому собираем уникальные id покупок по двум веткам и суммируем один раз.
  let earnedTotal = 0
  {
    const ids = new Set<string>()
    if (lessonIds.length > 0) {
      const { data: rows } = await supabase
        .from('purchases')
        .select('id, coach_earnings')
        .eq('payment_status', 'completed')
        .in('lesson_id', lessonIds)
      for (const r of rows || []) ids.add(r.id)
    }
    if (courseIds.length > 0) {
      const { data: rows } = await supabase
        .from('purchases')
        .select('id, coach_earnings')
        .eq('payment_status', 'completed')
        .in('course_id', courseIds)
      for (const r of rows || []) ids.add(r.id)
    }
    // coach_earnings нужны значениями — перечитываем одним запросом по id
    if (ids.size > 0) {
      const { data: rows } = await supabase
        .from('purchases')
        .select('id, coach_earnings')
        .in('id', Array.from(ids))
      for (const r of rows || []) earnedTotal += Number(r.coach_earnings ?? 0)
    }
  }

  // Подписки: автор известен прямо в журнале списаний.
  const { data: subRows } = await supabase
    .from('subscription_payments')
    .select('coach_earnings, status')
    .eq('coach_user_id', user.id)
    .eq('status', 'completed')
  for (const r of subRows || []) earnedTotal += Number(r.coach_earnings ?? 0)

  // Заявки: paid и pending уменьшают доступный баланс.
  const { data: payoutRows } = await supabase
    .from('payout_requests')
    .select('id, amount, status, receipt_number, processed_at')
    .eq('coach_user_id', user.id)
  let withdrawnTotal = 0
  let pendingTotal = 0
  let activeRequestId: string | null = null
  let unreceiptedPayout: UnreceiptedPayout | null = null
  for (const r of payoutRows || []) {
    if (r.status === 'paid') {
      withdrawnTotal += Number(r.amount)
      // Выплата без чека «Мой налог» — блокирует новые заявки (берём последнюю)
      if (!r.receipt_number) {
        unreceiptedPayout = {
          id: r.id,
          amount: Number(r.amount),
          processed_at: r.processed_at,
        }
      }
    }
    if (r.status === 'pending') {
      pendingTotal += Number(r.amount)
      activeRequestId = r.id
    }
  }

  // Реквизиты заполнены? (нужны к первой выплате — п. 6.2 оферты)
  const { data: details } = await supabase
    .from('mentor_payout_details')
    .select('id')
    .eq('coach_user_id', user.id)
    .maybeSingle()

  return {
    ok: true,
    wallet: {
      earnedTotal: Math.round(earnedTotal * 100) / 100,
      withdrawnTotal: Math.round(withdrawnTotal * 100) / 100,
      pendingTotal: Math.round(pendingTotal * 100) / 100,
      available:
        Math.round((earnedTotal - withdrawnTotal - pendingTotal) * 100) / 100,
      hasPayoutDetails: Boolean(details),
      activeRequestId,
      unreceiptedPayout,
    },
  }
}

// Заявка на вывод: сумма от 1 000 ₽ и не больше доступного, реквизиты
// заполнены, активной заявки нет (UNIQUE-индекс в БД страхует от гонки).
export async function requestPayout(amountRub: number): Promise<PayoutActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const amount = Number(amountRub)
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== amount * 100) {
    return { ok: false, error: 'Сумма — число, максимум два знака после запятой' }
  }
  if (amount < MIN_PAYOUT_RUB) {
    return { ok: false, error: `Минимальная сумма вывода — ${MIN_PAYOUT_RUB.toLocaleString('ru-RU')} ₽` }
  }

  const walletRes = await getWalletSummary()
  if (!walletRes.ok) return { ok: false, error: walletRes.error }
  const wallet = walletRes.wallet

  if (wallet.activeRequestId) {
    return { ok: false, error: 'У вас уже есть заявка на рассмотрении' }
  }
  if (wallet.unreceiptedPayout) {
    const when = wallet.unreceiptedPayout.processed_at
      ? new Date(wallet.unreceiptedPayout.processed_at).toLocaleDateString('ru-RU')
      : 'прошлую'
    return {
      ok: false,
      error: `Приложите чек «Мой налог» к выплате от ${when} — форма в истории заявок ниже`,
    }
  }
  if (amount > wallet.available) {
    return {
      ok: false,
      error: `Доступно только ${wallet.available.toLocaleString('ru-RU')} ₽`,
    }
  }
  if (!wallet.hasPayoutDetails) {
    return { ok: false, error: 'Сначала заполните реквизиты для выплат выше на странице' }
  }

  const { error } = await supabase.from('payout_requests').insert({
    coach_user_id: user.id,
    amount,
    status: 'pending',
  })
  if (error) {
    if (String((error as { code?: string }).code) === '23505' || error.message.includes('duplicate')) {
      return { ok: false, error: 'У вас уже есть заявка на рассмотрении' }
    }
    return { ok: false, error: 'Не удалось отправить заявку — попробуйте ещё раз' }
  }

  // Подтверждение автору — уведомлением (у notifications нет INSERT-политики,
  // пишем сервисным ключом; тип 'payout' добавлен миграцией 2026-09-17).
  const admin = createAdminClient()
  if (admin) {
    await admin.from('notifications').insert({
      user_id: user.id,
      type: 'payout',
      title: 'Заявка на вывод принята',
      message: `Заявка на ${amount.toLocaleString('ru-RU')} ₽ передана на выплату. Выплата проводится в течение 10 рабочих дней (п. 6.5 оферты).`,
      link: '/dashboard/mentor/partner',
      is_read: false,
    })
  }

  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}

// Автор прикладывает номер чека «Мой налог» к своей выплаченной заявке.
// Пока чека нет — новые заявки на вывод заблокированы (см. requestPayout).
// Обновление — через SECURITY DEFINER-функцию attach_payout_receipt
// (миграция 2026-09-18): она проверяет владельца, статус paid и «чека ещё
// нет» внутри. Прямой UPDATE ментору RLS не разрешает — и правильно:
// иначе клиент мог бы менять amount/status своей заявки.
export async function attachReceipt(
  requestId: string,
  receiptNumber: string
): Promise<PayoutActionResult> {
  if (!UUID_RE.test(requestId)) return { ok: false, error: 'Некорректный запрос' }
  const receipt = receiptNumber.trim()
  if (receipt.length < 3 || receipt.length > 50) {
    return { ok: false, error: 'Укажите номер чека из приложения «Мой налог» (от 3 символов)' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { error } = await supabase.rpc('attach_payout_receipt', {
    p_request_id: requestId,
    p_receipt: receipt,
  })
  if (error) {
    return { ok: false, error: 'Не удалось приложить чек — заявка не найдена или чек уже есть' }
  }

  // След в журнале (пишем сервисным ключом: у audit_log INSERT только для
  // админов, а факт закрытия чека важен для учёта).
  const admin = createAdminClient()
  if (admin) {
    await admin.from('audit_log').insert({
      actor_user_id: user.id,
      action: 'payout_receipt_attached',
      entity: 'payout_requests',
      entity_id: requestId,
      details: { receipt_number: receipt },
    })
  }

  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}