'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BreadcrumbItem {
  label: string
  href: string
}

export default function Breadcrumbs() {
  const pathname = usePathname()
  
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []
    
    let accumulatedPath = ''
    
    const labels: Record<string, string> = {
      'admin': 'Админ-панель',
      'stop-list': 'Стоп-лист',
      'reports': 'Жалобы',
      'banned-words': 'Запрещённые слова',
      'feedback': 'Обратная связь',
      'settings': 'Настройки',
      'users': 'Пользователи',
    }
    
    for (const path of paths) {
      accumulatedPath += `/${path}`
      breadcrumbs.push({
        label: labels[path] || path,
        href: accumulatedPath,
      })
    }
    
    return breadcrumbs
  }
  
  const breadcrumbs = getBreadcrumbs()
  
  if (breadcrumbs.length === 0) return null
  
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
      <Link href="/" className="hover:text-purple-600 transition-colors">
        Главная
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-2">
          <span className="text-gray-400">/</span>
          {index === breadcrumbs.length - 1 ? (
            <span className="text-gray-900 font-medium">{crumb.label}</span>
          ) : (
            <Link 
              href={crumb.href} 
              className="hover:text-purple-600 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}