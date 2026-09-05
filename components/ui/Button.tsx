import Link from 'next/link'

// Базовые стили — общий каркас всех вариантов
const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition-[box-shadow,background-color,color,border-color,transform] disabled:opacity-50 disabled:pointer-events-none'

// Варианты внешнего вида. primary = существующий gradient-btn (вид не меняется)
const VARIANTS = {
  primary: 'gradient-btn text-white shadow-lg shadow-purple-500/30',
  outline: 'border border-purple-200 text-purple-700 bg-transparent hover:bg-purple-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/30',
  /** Контурная красная — удаление и другие деструктивные действия в ряду с обычными кнопками */
  dangerOutline: 'border border-red-200 text-red-600 bg-transparent hover:bg-red-50',
  ghost: 'text-purple-700 bg-transparent hover:bg-purple-50',
} as const

// Размеры
const SIZES = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
} as const

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** primary — градиентная (главное действие), outline — с рамкой, danger — удаление, ghost — без фона */
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  /** Если задан — рендерится ссылка (Link) вместо кнопки */
  href?: string
  /** Показывает спиннер и блокирует нажатия */
  loading?: boolean
  /** Растянуть на всю ширину контейнера */
  fullWidth?: boolean
  className?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  loading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const cls = [BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className]
    .filter(Boolean)
    .join(' ')

  const content = loading ? (
    <>
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {children}
    </>
  ) : (
    children
  )

  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={disabled || loading}>
        {content}
      </Link>
    )
  }

  return (
    <button type={type ?? 'button'} disabled={disabled || loading} className={cls} {...rest}>
      {content}
    </button>
  )
}