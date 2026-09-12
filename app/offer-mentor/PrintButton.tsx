'use client'

import { Printer } from 'lucide-react'

// «Скачать» договор = печать в PDF из браузера (Ctrl+P → «Сохранить как PDF»).
// Генерацию PDF на сервере не городим — браузерная печать делает то же самое.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium"
    >
      <Printer className="w-4 h-4" strokeWidth={1.5} />
      Распечатать / сохранить в PDF
    </button>
  )
}