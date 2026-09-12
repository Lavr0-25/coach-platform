'use client'

// Кнопка платной подписки на автора (Ф3 спеки payments.md). Состояния:
//  — подписки нет: выбор периода 1/6/12 мес → startSubscription → Robokassa;
//  — активна: зелёная плашка «оплачено до …» + «Отменить» (доступ до конца
//    оплаченного периода — отменённая подписка продолжает работать);
//  — отменена (период ещё не истёк): плашка «доступ до …» + форма продления.
// Родитель может передать состояние подписки (серверные страницы уроков и
// курсов уже читают его через lib/access) — или не передавать, тогда компонент
// сам спросит БД (RLS разрешает читать свои строки; так делает профиль ментора).

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  startSubscription,
  cancelSubscription,
  type StartSubscriptionResult,
} from '@/app/actions/subscription'

export type SubscriptionInfo = { status: 'active' | 'cancelled'; periodEnd: string }

type Props = {
  coachUserId: string
  monthlyPrice: number
  // Текущее состояние подписки; undefined = родитель не знает — спросим сами
  subscription?: SubscriptionInfo | null
}

const PERIODS: Array<1 | 6 | 12> = [1, 6, 12]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

export default function SubscriptionButton({ coachUserId, monthlyPrice, subscription }: Props) {
  const router = useRouter()
  const [sub, setSub] = useState<SubscriptionInfo | null | undefined>(subscription)
  const [months, setMonths] = useState<1 | 6 | 12>(1)
  const [cancelling, setCancelling] = useState(false)

  // Родитель передал свежее серверное состояние (после router.refresh) — берём его
  useEffect(() => {
    if (subscription !== undefined) setSub(subscription)
  }, [subscription])

  // Состояние не передано (профиль ментора — клиентский компонент) — читаем сами
  useEffect(() => {
    if (subscription !== undefined) return
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id === coachUserId) {
        if (mounted) setSub(null)
        return
      }
      const { data } = await supabase
        .from('paid_subscriptions')
        .select('status, period_end')
        .eq('user_id', user.id)
        .eq('coach_user_id', coachUserId)
        .in('status', ['active', 'cancelled'])
        .gte('period_end', new Date().toISOString())
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (mounted) {
        setSub(
          data
            ? { status: data.status as 'active' | 'cancelled', periodEnd: data.period_end }
            : null
        )
      }
    })()
    return () => { mounted = false }
  }, [coachUserId, subscription])

  const [state, formAction, pending] = useActionState(
    async (_prev: StartSubscriptionResult | null, formData: FormData): Promise<StartSubscriptionResult> =>
      startSubscription(formData),
    null
  )

  useEffect(() => {
    if (state?.ok) window.location.href = state.url
  }, [state])

  async function handleCancel() {
    if (!confirm('Отменить подписку? Доступ к материалам сохранится до конца оплаченного периода.')) return
    setCancelling(true)
    try {
      const formData = new FormData()
      formData.set('coachUserId', coachUserId)
      const res = await cancelSubscription(formData)
      if (!res.ok) {
        alert(res.error || 'Не удалось отменить подписку')
        return
      }
      setSub(s => (s ? { ...s, status: 'cancelled' } : null))
      router.refresh()
    } finally {
      setCancelling(false)
    }
  }

  // === Подписка активна: плашка + отмена ===
  if (sub?.status === 'active') {
    return (
      <div className="inline-flex flex-wrap items-center gap-3">
        <span className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-md shadow-teal-500/20">
          Подписка активна — оплачено до {fmtDate(sub.periodEnd)}
        </span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {cancelling ? 'Отменяем…' : 'Отменить'}
        </button>
      </div>
    )
  }

  const isRenewal = sub?.status === 'cancelled'

  // === Нет подписки / отменена: выбор периода + оплата ===
  return (
    <form action={formAction} className="inline-flex flex-col gap-3 max-w-md">
      <input type="hidden" name="coachUserId" value={coachUserId} />
      <input type="hidden" name="months" value={months} />

      {isRenewal && (
        <span className="bg-amber-100 text-amber-700 text-sm font-bold px-4 py-2 rounded-full self-start">
          Подписка отменена — доступ до {fmtDate(sub.periodEnd)}
        </span>
      )}

      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setMonths(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              months === p
                ? 'border-purple-600 bg-purple-50 text-purple-700'
                : 'border-purple-200 bg-white text-gray-600 hover:bg-purple-50'
            }`}
          >
            {p} мес · {monthlyPrice * p} ₽
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
      >
        {pending ? (
          'Переходим к оплате…'
        ) : (
          <>
            {isRenewal ? 'Продлить' : 'Подписаться'} — {monthlyPrice * months} ₽
            <span className="opacity-80 text-sm font-normal">
              ({monthlyPrice} ₽/мес × {months})
            </span>
          </>
        )}
      </button>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}