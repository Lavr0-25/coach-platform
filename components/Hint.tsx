'use client'

import { Info } from 'lucide-react'

/**
 * Всплывающая подсказка «что это и зачем»: маленькая иконка «i», при
 * наведении курсора или тапе появляется пояснение.
 *
 * Сделана кнопкой, а не span с title: нативный title появляется с задержкой
 * и не работает на тач-экранах, а тап по кнопке даёт ей фокус — подсказка
 * видна и на телефоне, и при навигации с клавиатуры. Повторный тап мимо
 * (или Escape) снимает фокус и прячет подсказку.
 */
export function Hint({ text, side = 'top', className = '' }: {
  text: string
  /** Куда выезжает подсказка относительно иконки */
  side?: 'top' | 'bottom'
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={text}
      className={`group/hint relative inline-flex shrink-0 cursor-help align-middle focus:outline-none ${className}`}
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
    >
      <Info
        className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover/hint:text-gray-700 group-focus/hint:text-gray-700"
        strokeWidth={2}
      />
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 w-56 max-w-[70vw] -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus/hint:opacity-100 ${
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
      >
        {text}
      </span>
    </button>
  )
}