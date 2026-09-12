'use server'

// Ф3 спеки payments.md: платные подписки на автора через Robokassa.
// Периоды 1/6/12 месяцев (решение Анатолия 11.09), цена — месячная ставка
// ментора × месяцы, без скидок (добавим, когда попросят менторы).
// Продление — ручное: новый платёж продлевает период; автосписание — Ф3.2.
//
// Action создаёт/переиспользует строку paid_subscriptions (pending) и запись
// в журнале subscription_payments, возвращает URL платёжной страницы.
// Статус active проставляет ТОЛЬКО вебхук (app/api/robokassa/result) —
// SuccessURL из браузера доверием не является. Всё через сервисный ключ:
// клиентских INSERT/UPDATE-политик у этих таблиц намеренно нет.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPaymentUrl, isRobokassaConfigured } from '@/lib/robokassa'

export type StartSubscriptionResult = { ok: true; url: string } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Комиссия платформы из system_settings (Ф1), fallback 30% — как в purchase.ts
async function getCommissionPercent(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  if (!supabase) return 30
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'platform_commission')
    .maybeSingle()
  const percent = Number(data?.value?.percent)
  return Number.isFinite(percent) && percent >= 0 && percent <= 90 ? percent : 30
}

export async function startSubscription(formData: FormData): Promise<StartSubscriptionResult> {
  const coachUserId = String(formData.get('coachUserId') || '')
  const months = Number(formData.get('months'))

  if (!UUID_RE.test(coachUserId) || (months !== 1 && months !== 6 && months !== 12)) {
    return { ok: false, error: 'Некорректный запрос' }
  }
  if (!isRobokassaConfigured()) {
    return { ok: false, error: 'Онлайн-оплата временно недоступна' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход: войдите, чтобы оформить подписку' }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Сервис оплаты недоступен' }

  // 1. Автор: рубильник включён, цена за месяц задана (вилка 99–9990, CHECK в БД)
  const { data: coach } = await admin
    .from('coaches')
    .select('user_id, display_name, paid_publishing_allowed, subscription_price')
    .eq('user_id', coachUserId)
    .maybeSingle()
  if (!coach?.paid_publishing_allowed) {
    return { ok: false, error: 'Подписка на этого автора пока недоступна' }
  }
  const monthlyPrice = Number(coach.subscription_price)
  if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
    return { ok: false, error: 'Автор ещё не настроил подписку' }
  }
  if (user.id === coachUserId) {
    return { ok: false, error: 'Нельзя подписаться на самого себя' }
  }

  // 2. Деньги: сумма = цена × месяцы; комиссия от всей суммы платежа
  const amount = Math.round(monthlyPrice * months * 100) / 100
  const percent = await getCommissionPercent(admin)
  const platformCommission = Math.round(amount * percent) / 100
  const coachEarnings = Math.round((amount - platformCommission) * 100) / 100

  // 3. Подписка: не-active строку пары переиспользуем (снова pending),
  //    иначе создаём новую. Активная строка пары существует → уже подписан.
  const invId = Date.now().toString()
  let subscriptionId: string | null = null
  let subError: string | null = null

  const { data: activeRow } = await admin
    .from('paid_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('coach_user_id', coachUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (activeRow) return { ok: false, error: 'Подписка уже активна — обновите страницу' }

  const { data: existingRow } = await admin
    .from('paid_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('coach_user_id', coachUserId)
    .neq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingRow) {
    // period_end ставим «сейчас» как временную точку — вебхук прибавит к ней
    // купленные месяцы; price — снимок текущей цены ментора.
    const { data, error } = await admin
      .from('paid_subscriptions')
      .update({
        status: 'pending',
        price: monthlyPrice,
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        inv_id: invId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id)
      .neq('status', 'active') // гонка с вебхуком: активную строку не трогаем
      .select('id')
    subscriptionId = data?.[0]?.id ?? null
    subError = error?.message ?? (subscriptionId ? null : 'Подписка уже активна')
  } else {
    const { data, error } = await admin
      .from('paid_subscriptions')
      .insert({
        user_id: user.id,
        coach_user_id: coachUserId,
        status: 'pending',
        price: monthlyPrice,
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        inv_id: invId,
      })
      .select('id')
    subscriptionId = data?.[0]?.id ?? null
    subError = error?.message ?? (subscriptionId ? null : 'Не удалось создать подписку')
  }
  if (!subscriptionId) {
    return { ok: false, error: 'Не удалось оформить подписку — попробуйте ещё раз' }
  }

  // 4. Журнал списаний: запись pending с комиссией; inv_id уникальный =
  //    идемпотентность вебхука. Коллизия почти невозможна, при ней — +1.
  const paymentInsert = {
    subscription_id: subscriptionId,
    user_id: user.id,
    coach_user_id: coachUserId,
    amount,
    platform_commission: platformCommission,
    coach_earnings: coachEarnings,
    period_months: months,
    inv_id: invId,
    status: 'pending' as const,
  }
  let payError = (await admin.from('subscription_payments').insert(paymentInsert)).error
  if (payError && String(payError.message).includes('duplicate key')) {
    const retryInvId = (Number(invId) + 1).toString()
    payError = (
      await admin
        .from('subscription_payments')
        .insert({ ...paymentInsert, inv_id: retryInvId })
    ).error
    if (!payError) {
      await admin
        .from('paid_subscriptions')
        .update({ inv_id: retryInvId })
        .eq('id', subscriptionId)
    }
  }
  if (payError) {
    return { ok: false, error: 'Не удалось создать заказ — попробуйте ещё раз' }
  }

  // 5. URL платёжной страницы — браузер уходит на Robokassa
  const name = coach.display_name ? ` «${coach.display_name}»` : ''
  const description = `Подписка на автора${name}, ${months} мес. — Верный путь`
  return { ok: true, url: buildPaymentUrl(invId, amount, description) }
}

// Отмена подписки учеником: статус cancelled, доступ остаётся до period_end
// (его покажет UI). RLS у paid_subscriptions не даёт клиенту UPDATE —
// работаем через сервисный ключ, вход проверен выше.
export async function cancelSubscription(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const coachUserId = String(formData.get('coachUserId') || '')
  if (!UUID_RE.test(coachUserId)) return { ok: false, error: 'Некорректный запрос' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Сервис недоступен' }

  const { data, error } = await admin
    .from('paid_subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('coach_user_id', coachUserId)
    .eq('status', 'active')
    .select('id')

  if (error) return { ok: false, error: 'Не удалось отменить подписку' }
  if (!data?.length) return { ok: false, error: 'Активная подписка не найдена — обновите страницу' }
  return { ok: true }
}