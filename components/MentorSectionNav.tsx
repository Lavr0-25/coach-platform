'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Ссылки на разделы кабинета ментора — одна навигация вместо кнопок «Назад».
// Показывается на всех страницах менторского раздела; текущая страница подсвечена.
const SECTION_LINKS = [
  { href: '/dashboard/mentor', label: 'Кабинет' },
  { href: '/dashboard/mentor/lessons', label: 'Мои уроки' },
  { href: '/dashboard/mentor/courses', label: 'Мои курсы' },
  { href: '/dashboard/mentor/subscribers', label: 'Подписчики' },
  { href: '/dashboard/ai', label: 'Управление с ИИ' },
  { href: '/mentor/analytics', label: 'Аналитика' },
  { href: '/dashboard/mentor/profile', label: 'Профиль' },
]

export function MentorSectionNav({ className = '' }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={`flex flex-wrap gap-x-5 gap-y-1 ${className}`} aria-label="Разделы кабинета">
      {SECTION_LINKS.map(link => {
        // «Кабинет» (/dashboard/mentor) — только точное совпадение, иначе он
        // подсвечивался бы и на всех вложенных страницах (курсы, профиль и т.д.)
        const isActive =
          link.href === '/dashboard/mentor'
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + '/')
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'text-sm font-semibold text-purple-700 border-b-2 border-purple-600 pb-0.5 transition-colors'
                : 'text-sm text-gray-500 hover:text-purple-700 transition-colors'
            }
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}