// Хелперы доступа к платным материалам (Ф3 спеки payments.md).
// Логика доступа живёт на сервере (server components/actions), не на клиенте.

import type { SupabaseClient } from '@supabase/supabase-js'

export type PaidSubscriptionInfo = {
  status: 'active' | 'cancelled'
  periodEnd: string
}

// Платная подписка ученика на автора, дающая доступ прямо сейчас:
// active — подписка действует; cancelled — ученик отменил, но доступ
// сохраняется до конца оплаченного периода (period_end ≥ now).
// expired/pending сюда не попадают: первый — период истёк (pg_cron),
// вторая — оплата ещё не подтверждена вебхуком.
export async function getPaidSubscription(
  supabase: SupabaseClient,
  userId: string,
  coachUserId: string
): Promise<PaidSubscriptionInfo | null> {
  const { data } = await supabase
    .from('paid_subscriptions')
    .select('status, period_end')
    .eq('user_id', userId)
    .eq('coach_user_id', coachUserId)
    .in('status', ['active', 'cancelled'])
    .gte('period_end', new Date().toISOString())
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { status: data.status as 'active' | 'cancelled', periodEnd: data.period_end }
}