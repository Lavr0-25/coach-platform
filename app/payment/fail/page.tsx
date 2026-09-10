// Страница FailURL (Ф2): покупатель отменил оплату или платёж не прошёл.
// Запись purchases остаётся в pending — её можно повторить кнопкой «Купить».

import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export default function PaymentFailPage() {
  return (
    <div className="max-w-lg mx-auto pt-10">
      <Card className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата не прошла</h1>
        <p className="text-gray-600 mb-6">
          Платёж отменён или не завершился. Деньги не списаны — можно попробовать ещё раз
          кнопкой «Купить» на странице материала.
        </p>
        <Link
          href="/dashboard"
          className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 inline-block"
        >
          В мой кабинет
        </Link>
      </Card>
    </div>
  )
}