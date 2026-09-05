import Link from 'next/link'
import { Card } from '@/components/ui/Card'

// Кастомная 404 (dogfood #7): посетитель не «выпадает» из продукта —
// брендированная страница с навигацией вместо стандартной Next.js
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-24 pb-16">
      <Card variant="glow" padding="none" className="p-8 sm:p-12 text-center max-w-lg w-full">
        <div className="text-6xl mb-4">🧭</div>
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text mb-3">404</h1>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Страница не найдена</h2>
        <p className="text-gray-600 mb-8">
          Похоже, такой страницы нет или она переехала.
          Зато у нас есть много полезного на главной.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-colors"
          >
            На главную
          </Link>
          <Link
            href="/mentors"
            className="bg-white text-purple-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-colors"
          >
            Все авторы
          </Link>
        </div>
      </Card>
    </main>
  )
}