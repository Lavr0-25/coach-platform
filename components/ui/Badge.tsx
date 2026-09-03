// Цветовые варианты бейджа — те же сочетания, что использовались
// в chip-константах админки и статусах обращений
const COLORS = {
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-600',
} as const

export interface BadgeProps {
  variant?: keyof typeof COLORS
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'purple', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${COLORS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}