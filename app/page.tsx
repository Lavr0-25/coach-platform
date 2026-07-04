import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">CoachPlatform</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">Добро пожаловать! 👋</h2>
          <p className="text-xl text-gray-600 mb-8">
            Платформа для обучения и создания уроков
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/catalog" className="bg-blue-600 text-white px-8 py-3 rounded-lg">
              📚 Каталог уроков
            </Link>
            <Link href="/login" className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg">
              🔐 Войти
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}