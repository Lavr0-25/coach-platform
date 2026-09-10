// Вебхук Robokassa ResultURL (Ф2 спеки payments.md).
// Robokassa вызывает GET с OutSum, InvId, SignatureValue; в ответ ждёт
// `OK<InvId>` — иначе будет повторять вызов. Это ЕДИНСТВЕННОЕ место, где
// покупка переводится в completed: SuccessURL из браузера доверием не является.
//
// Проверки по критериям Ф2:
//   1) подпись md5(`${OutSum}:${InvId}:${password2}`) — верхний регистр;
//   2) сумма совпадает с заказом;
//   3) идемпотентность: повторный вебхук по тому же inv_id не дублирует
//      запись (inv_id уникальный, повторный вызов просто снова отвечает OK).

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

  const { data: purchase } = await admin
    .from('purchases')
    .select('id, amount, payment_status')
    .eq('inv_id', invId)
    .maybeSingle()

  if (!purchase) return new Response('unknown InvId', { status: 404 })

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