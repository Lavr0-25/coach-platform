'use server'

// Ф2 спеки payments.md: разовые покупки через Robokassa.
// Action создаёт запись purchases (pending, свой inv_id) и возвращает URL
// платёжной страницы. Статус completed проставляет ТОЛЬКО вебхук
// (app/api/robokassa/result) — SuccessURL из браузера доверием не является.
//
// Вставка/обновление идут через сервисный ключ (createAdminClient):
// RLS на purchases разрешает только чтение своих строк, а проверка прав
// (вход, публикация, цена, рубильник paid_publishing_allowed) сделана
// руками выше — паттерн из Ф1, сервисный код доверенный.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPaymentUrl, isRobokassaConfigured } from '@/lib/robokassa'

export type StartPurchaseResult = { ok: true; url: string } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Комиссия платформы из system_settings (настройка админки, Ф1), fallback 30%
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

export async function startPurchase(formData: FormData): Promise<StartPurchaseResult> {
  const itemType = String(formData.get('itemType') || '')
  const itemId = String(formData.get('itemId') || '')

  if ((itemType !== 'lesson' && itemType !== 'course') || !UUID_RE.test(itemId)) {
    return { ok: false, error: 'Некорректный запрос' }
  }
  if (!isRobokassaConfigured()) {
    return { ok: false, error: 'Онлайн-оплата временно недоступна' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход: войдите, чтобы купить материал' }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Сервис оплаты недоступен' }

  // 1. Товар: опубликован, платный, с ценой
  const table = itemType === 'lesson' ? 'lessons' : 'courses'
  const { data: item } = await admin
    .from(table)
    .select('id, title, price, coach_id, is_published')
    .eq('id', itemId)
    .maybeSingle()

  if (!item || !item.is_published) return { ok: false, error: 'Материал не найден или не опубликован' }
  const price = Number(item.price)
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'Этот материал бесплатный' }

  // 2. Рубильник платных продаж у автора (Ф1: default false, менять может только админ)
  const { data: coach } = await admin
    .from('coaches')
    .select('paid_publishing_allowed')
    .eq('id', item.coach_id)
    .maybeSingle()
  if (!coach?.paid_publishing_allowed) {
    return { ok: false, error: 'Продажа этого материала пока недоступна' }
  }

  // 3. Уже куплено? (двойной доступ не мешает, но второй платёж бессмыслен)
  const { data: existing } = await admin
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq(itemType === 'lesson' ? 'lesson_id' : 'course_id', itemId)
    .eq('payment_status', 'completed')
    .maybeSingle()
  if (existing) return { ok: false, error: 'Этот материал уже куплен — обновите страницу' }

  // 4. Деньги: комиссия из настроек, роялти автору — остаток
  const percent = await getCommissionPercent(admin)
  const platformCommission = Math.round(price * percent) / 100
  const coachEarnings = Math.round((price - platformCommission) * 100) / 100

  // 5. Запись pending. inv_id — числовая строка (требование Robokassa),
  //    уникальный индекс даёт идемпотентность; коллизия почти невозможна,
  //    но при ней повторяем один раз с бОльшим номером.
  const invId = Date.now().toString()
  const insertRow = {
    user_id: user.id,
    amount: price,
    platform_commission: platformCommission,
    coach_earnings: coachEarnings,
    payment_status: 'pending' as const,
    inv_id: invId,
    lesson_id: itemType === 'lesson' ? itemId : null,
    course_id: itemType === 'course' ? itemId : null,
  }

  let insertError: string | null = null
  let finalInvId = invId
  {
    const { error } = await admin.from('purchases').insert(insertRow)
    insertError = error?.message ?? null
    if (insertError && error_code(insertError) === 'duplicate') {
      finalInvId = (Number(invId) + 1).toString()
      const { error: retryError } = await admin
        .from('purchases')
        .insert({ ...insertRow, inv_id: finalInvId })
      insertError = retryError?.message ?? null
    }
  }
  if (insertError) return { ok: false, error: 'Не удалось создать заказ — попробуйте ещё раз' }

  // 6. URL платёжной страницы — браузер уходит на Robokassa
  const description = itemType === 'lesson'
    ? `Покупка урока «${item.title}» — Верный путь`
    : `Покупка курса «${item.title}» — Верный путь`

  return { ok: true, url: buildPaymentUrl(finalInvId, price, description) }
}

// Грубый разбор кода ошибки Postgres (23505 = unique_violation)
function error_code(message: string): string {
  return message.includes('duplicate key') ? 'duplicate' : 'other'
}