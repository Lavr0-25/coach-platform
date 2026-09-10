// Страница SuccessURL (Ф2). Параметры Robokassa (OutSum/InvId) не проверяем —
// источник истины об оплате вебхук ResultURL; здесь только человеческий ответ.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export default function PaymentSuccessPage() {
  return (
    <div className="max-w-lg mx-auto pt-10">
      <Card className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата прошла</h1>
        <p className="text-gray-600 mb-6">
          Доступ к материалу уже открыт — обновите страницу материала.
          Если что-то не отобразилось, подождите пару секунд и обновите ещё раз.
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