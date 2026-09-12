import type { Metadata } from 'next'
import { PrintButton } from './PrintButton'
import { OfferMentorContent } from '@/components/OfferMentorContent'

export const metadata: Metadata = {
  title: 'Договор-оферта с автором - RightWay',
  description:
    'Публичная оферта о заключении лицензионного договора с автором контента платформы «Верный путь»',
}

// Публичный текст договора-оферты с автором (Ф6.1, версия 1.0 — 12.09.2026).
// Сам текст — в components/OfferMentorContent.tsx (общий с /offer-mentor/print).
export default function OfferMentorPage() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl pt-24 sm:pt-28 print:pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 print:hidden">
        <h1 className="text-3xl font-bold gradient-text">Договор-оферта с автором</h1>
        <PrintButton />
      </div>

      <OfferMentorContent />
    </div>
  )
}