'use client'

// Кнопка покупки (Ф2): вызывает server action startPurchase, при успехе
// уводит браузер на платёжную страницу Robokassa. Заменяет заглушку
// «Онлайн-оплата появится скоро» в app/lesson/[id] и app/course/[id].

import { useActionState, useEffect } from 'react'
import { startPurchase, type StartPurchaseResult } from '@/app/actions/purchase'

type Props = {
  itemType: 'lesson' | 'course'
  itemId: string
  label: string
}

export default function PurchaseButton({ itemType, itemId, label }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: StartPurchaseResult | null, formData: FormData): Promise<StartPurchaseResult> =>
      startPurchase(formData),
    null
  )

  useEffect(() => {
    if (state?.ok) window.location.href = state.url
  }, [state])

  return (
    <form action={formAction} className="inline-flex flex-col gap-2">
      <input type="hidden" name="itemType" value={itemType} />
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-colors inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {pending ? 'Переходим к оплате…' : label}
      </button>
      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}