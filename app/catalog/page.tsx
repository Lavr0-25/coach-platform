import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import CatalogClient from './CatalogClient'

export default async function CatalogPage() {
  const supabase = await createClient()

  // Загружаем уроки с информацией о наставниках
  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      created_at,
      coaches (
        id,
        display_name,
        specialization
      ),
      lesson_content (
        content_type
      )
    `)
    .limit(100)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Каталог уроков
          </h1>
          <p className="text-gray-600">
            Изучайте бесплатные материалы и находите полезные курсы
          </p>
        </div>

        <CatalogClient initialLessons={lessons || []} />
      </main>
    </div>
  )
}