const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const

const ROUNDED = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
} as const

export interface CardProps {
  children: React.ReactNode
  /** Внутренние отступы: none/sm/md/lg (по умолчанию md) */
  padding?: keyof typeof PADDING
  /** Скругление углов: lg/xl/2xl (по умолчанию xl) */
  rounded?: keyof typeof ROUNDED
  /** Подъём карточки при наведении (для кликабельных карточек-ссылок) */
  hover?: boolean
  className?: string
}

export function Card({
  children,
  padding = 'md',
  rounded = 'xl',
  hover = false,
  className = '',
}: CardProps) {
  const cls = [
    'bg-white border border-purple-100 shadow-sm',
    PADDING[padding],
    ROUNDED[rounded],
    hover && 'transition-[box-shadow,transform] hover:shadow-lg hover:-translate-y-1',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={cls}>{children}</div>
}