// Вебхук Robokassa ResultURL (Ф2/Ф3 спеки payments.md).
// Robokassa вызывает GET с OutSum, InvId, SignatureValue; в ответ ждёт
// `OK<InvId>` — иначе будет повторять вызов. Это ЕДИНСТВЕННОЕ место, где
// покупка/подписка переводится в оплаченное состояние: SuccessURL из браузера
// доверием не является.
//
// Проверки по критериям Ф2:
//   1) подпись md5(`${OutSum}:${InvId}:${password2}`) — верхний регистр;
//   2) сумма совпадает с заказом;
//   3) идемпотентность: повторный вебхук по тому же inv_id не дублирует
//      запись и не продлевает подписку второй раз (inv_id уникальный,
//      перевод в completed делается условным UPDATE — гонка двух вебхуков
//      даёт второму 0 строк).
//
// Ф3: сначала ищем InvId в разовых покупках (purchases), затем в журнале
// подписок (subscription_payments). Для подписки подтверждение платежа
// продлевает период: новый период начинается «встык» после текущего
// оплаченного (продление) или сейчас (первая активация).

import { createAdminClient } from '@/lib/supabase/admin'
import { verifyResultSignature } from '@/lib/robokassa'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const outSum = url.searchParams.get('OutSum') || ''
  const invId = url.searchParams.get('InvId') || ''
  const signature = url.searchParams.get('SignatureValue')

  if (!outSum || !invId || !verifyResultSignature(outSum, invId, signature)) {
    return new Response('bad signature', { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return new Response('service unavailable', { status: 500 })

  // 1. Разовая покупка (Ф2)
  const { data: purchase } = await admin
    .from('purchases')
    .select('id, amount, payment_status')
    .eq('inv_id', invId)
    .maybeSingle()

  if (purchase) {
    if (Number(purchase.amount) !== Number(outSum)) {
      return new Response('amount mismatch', { status: 400 })
    }
    if (purchase.payment_status !== 'completed') {
      const { error } = await admin
        .from('purchases')
        .update({ payment_status: 'completed', purchased_at: new Date().toISOString() })
        .eq('id', purchase.id)
        .eq('payment_status', 'pending') // гонка двух вебхуков: второй получит 0 строк
      if (error) return new Response('db error', { status: 500 })
    }
    return new Response(`OK${invId}`)
  }

  // 2. Платёж по подписке (Ф3)
  const { data: payment } = await admin
    .from('subscription_payments')
    .select('id, amount, status, subscription_id, period_months')
    .eq('inv_id', invId)
    .maybeSingle()

  if (!payment) return new Response('unknown InvId', { status: 404 })

  if (Number(payment.amount) !== Number(outSum)) {
    return new Response('amount mismatch', { status: 400 })
  }

  if (payment.status === 'completed') {
    return new Response(`OK${invId}`) // повторный вебхук — просто подтверждаем
  }

  // Переводим платёж в completed условным UPDATE: если 0 строк — параллельный
  // вебхук уже обработал этот платёж (и уже продлил подписку), дублировать не надо.
  const { data: completed, error: payError } = await admin
    .from('subscription_payments')
    .update({ status: 'completed', paid_at: new Date().toISOString() })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('id')
  if (payError) return new Response('db error', { status: 500 })
  if (!completed?.length) return new Response(`OK${invId}`)

  // Продлеваем подписку. period_start — «встык» за текущим периодом, если
  // подписка уже была активна (ученик продлил заранее), иначе сейчас.
  const { data: sub } = await admin
    .from('paid_subscriptions')
    .select('id, status, period_end, user_id, coach_user_id')
    .eq('id', payment.subscription_id)
    .maybeSingle()
  if (!sub) return new Response('db error', { status: 500 })

  const now = new Date()
  const wasActive = sub.status === 'active'
  const start = wasActive && sub.period_end && new Date(sub.period_end) > now
    ? new Date(sub.period_end)
    : now
  const end = new Date(start)
  end.setMonth(end.getMonth() + Number(payment.period_months))

  const { error: subError } = await admin
    .from('paid_subscriptions')
    .update({
      status: 'active',
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      inv_id: invId,
      updated_at: now.toISOString(),
    })
    .eq('id', sub.id)

  if (subError && subError.code === '23505') {
    // Уникальный констрейнт «одна активная подписка на пару»: гонка двойного
    // оформления (две вкладки) или повторное начало при живой подписке.
    // Денег ученику терять нельзя — месяцы переносим в уже активную строку
    // пары («встык»), дубликат закрываем как cancelled. Robokassa получит OK
    // и не уйдёт в бесконечные ретраи.
    const { data: other } = await admin
      .from('paid_subscriptions')
      .select('id, status, period_end')
      .eq('user_id', sub.user_id)
      .eq('coach_user_id', sub.coach_user_id)
      .eq('status', 'active')
      .neq('id', sub.id)
      .maybeSingle()
    if (!other) return new Response('db error', { status: 500 })

    const otherEnd =
      other.period_end && new Date(other.period_end) > now
        ? new Date(other.period_end)
        : now
    const mergedEnd = new Date(otherEnd)
    mergedEnd.setMonth(mergedEnd.getMonth() + Number(payment.period_months))

    const { error: mergeError } = await admin
      .from('paid_subscriptions')
      .update({
        period_end: mergedEnd.toISOString(),
        inv_id: invId,
        updated_at: now.toISOString(),
      })
      .eq('id', other.id)
    if (mergeError) return new Response('db error', { status: 500 })

    await admin
      .from('paid_subscriptions')
      .update({ status: 'cancelled', updated_at: now.toISOString() })
      .eq('id', sub.id)

    return new Response(`OK${invId}`)
  }

  if (subError) return new Response('db error', { status: 500 })

  return new Response(`OK${invId}`)
}