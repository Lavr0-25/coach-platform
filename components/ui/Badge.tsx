// Цветовые варианты бейджа. Палитра «50 + рамка» — статусы обращений,
// «плотная» (bg-*-100 без рамки) — роли, «Бесплатно», «Опубликовано»
const COLORS = {
  purple: 'border border-purple-200 bg-purple-50 text-purple-700',
  blue: 'border border-blue-200 bg-blue-50 text-blue-700',
  green: 'border border-green-200 bg-green-50 text-green-700',
  red: 'border border-red-200 bg-red-50 text-red-700',
  orange: 'border border-orange-200 bg-orange-50 text-orange-700',
  yellow: 'border border-yellow-200 bg-yellow-50 text-yellow-700',
  gray: 'border border-gray-200 bg-gray-50 text-gray-600',
  purpleFill: 'bg-purple-100 text-purple-700',
  greenFill: 'bg-green-100 text-green-700',
  grayFill: 'bg-gray-100 text-gray-700',
  redFill: 'bg-red-100 text-red-700',
} as const

export interface BadgeProps {
  variant?: keyof typeof COLORS
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'purple', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${COLORS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}