import { createAdminClient } from '@/lib/supabase/admin'

// Единый расчёт комиссии платформы (№32 + №33 бэклога, 2026-09-17).
// Порядок — по спеке payments.md («Комиссия платформы»):
//   1. Индивидуальная ставка админа (coaches.commission_rate, высший приоритет);
//   2. иначе глобальная ставка (system_settings.platform_commission, fallback 30%);
//   3. минус активные реферальные бенефиты (commission_benefits);
//   4. floor 0% — скидки не делают комиссию отрицательной.
// Используется в purchase.ts (разовые) и subscription.ts (подписки).

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

export type EffectiveCommission = {
  /** Итоговая ставка платформы, % от суммы платежа. */
  percent: number
  /** Что взято за основу: ручная ставка админа или глобальная. */
  base: 'manual' | 'global'
  /** Суммарная скидка реферальных бенефитов, п.п. (0 = не действуют). */
  benefitPp: number
}

export async function getEffectiveCommission(
  admin: AdminClient,
  coachUserId: string
): Promise<EffectiveCommission> {
  // 1. Ручная ставка админа: coaches.commission_rate (NULL = не задана —
  //    «снять индивидуальную ставку», см. setCoachCommissionRate).
  //    Внимание: Number(null) === 0 в JS, поэтому NULL проверяем явно —
  //    иначе снятая ставка читалась как «комиссия 0%».
  const { data: coach } = await admin
    .from('coaches')
    .select('commission_rate')
    .eq('user_id', coachUserId)
    .maybeSingle()

  const manual = coach?.commission_rate == null ? NaN : Number(coach.commission_rate)
  let base: EffectiveCommission['base'] = 'manual'
  let percent = Number.isFinite(manual) && manual >= 0 && manual <= 90 ? manual : NaN

  // 2. Глобальная ставка (fallback 30%) — только если ручной нет.
  if (!Number.isFinite(percent)) {
    base = 'global'
    percent = 30
    const { data: setting } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'platform_commission')
      .maybeSingle()
    const global = Number(setting?.value?.percent)
    if (Number.isFinite(global) && global >= 0 && global <= 90) percent = global
  }

  // 3. Активные бенефиты (реферальные и ручные скидки): revoked_at IS NULL
  //    и не истёк срок. Суммируются, floor 0.
  const { data: benefits } = await admin
    .from('commission_benefits')
    .select('discount_pp')
    .eq('coach_user_id', coachUserId)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.now()`)

  const benefitPp = (benefits || []).reduce((sum, b) => sum + Number(b.discount_pp || 0), 0)
  const final = Math.max(0, Math.round((percent - benefitPp) * 100) / 100)

  return { percent: final, base, benefitPp }
}