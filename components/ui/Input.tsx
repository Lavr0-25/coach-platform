import { forwardRef } from 'react'

// Общий каркас поля — доминирующий фиолетовый паттерн проекта
const FIELD_BASE =
  'w-full px-4 py-3 border border-purple-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color] disabled:opacity-60'

const SIZES = {
  md: '',
  /** compact — плотные формы кабинета/админки (px-4 py-2.5) */
  compact: 'px-4 py-2.5',
  sm: 'px-3 py-2 text-sm rounded-lg',
} as const

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** sm — компактный (px-3 py-2), md — стандартный (px-4 py-3) */
  size?: keyof typeof SIZES
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', className = '', ...rest },
  ref
) {
  return <input ref={ref} className={`${FIELD_BASE} ${SIZES[size]} ${className}`} {...rest} />
})

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: keyof typeof SIZES
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', className = '', ...rest },
  ref
) {
  return <textarea ref={ref} className={`${FIELD_BASE} ${SIZES[size]} ${className}`} {...rest} />
})

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Показать красную звёздочку обязательного поля */
  required?: boolean
}

export function Label({ required = false, className = '', children, ...rest }: LabelProps) {
  return (
    <label className={`block text-sm font-semibold text-gray-700 mb-2 ${className}`} {...rest}>
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  )
}