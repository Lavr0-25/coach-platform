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
  /**
   * Стиль карточки:
   * - plain (по умолчанию) — белая карточка с тонкой рамкой;
   * - glow — «светящаяся» карточка (класс .style-card: градиентная рамка
   *   и подсветка при наведении; скругление и ховер задаёт CSS).
   */
  variant?: 'plain' | 'glow'
  /** Внутренние отступы: none/sm/md/lg (по умолчанию md) */
  padding?: keyof typeof PADDING
  /** Скругление углов: lg/xl/2xl (по умолчанию xl; в glow игнорируется — задаёт CSS) */
  rounded?: keyof typeof ROUNDED
  /** Подъём карточки при наведении (для кликабельных карточек-ссылок) */
  hover?: boolean
  className?: string
}

export function Card({
  children,
  variant = 'plain',
  padding = 'md',
  rounded = 'xl',
  hover = false,
  className = '',
}: CardProps) {
  const isGlow = variant === 'glow'
  const cls = [
    isGlow ? 'style-card' : 'bg-white border border-purple-100 shadow-sm',
    PADDING[padding],
    !isGlow && ROUNDED[rounded],
    hover && 'transition-[box-shadow,transform] hover:shadow-lg hover:-translate-y-1',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={cls}>{children}</div>
}