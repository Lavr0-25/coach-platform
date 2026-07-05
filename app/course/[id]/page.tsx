import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(`
      *,
      coaches (
        id,
        display_name,
        specialization
      )
    `)
    .eq('id', id)
    .single()

  if (courseError || !course) {
    console.error('Course error:', courseError)
    notFound()
  }

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', id)
    .order('order_index', { ascending: true })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
          
          {course.coaches && (
            <Link
              href={`/mentor/${course.coaches.id}`}
              className="inline-flex items-center gap-2 text-blue-100 hover:text-white"
            >
              👨‍🏫 {course.coaches.display_name}
            </Link>
          )}

          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span>{lessons?.length || 0} уроков</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-2xl font-bold">
                {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {course.description && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">📖 О курсе</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{course.description}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-2xl font-bold mb-6">📚 Программа курса</h2>
          
          {lessons && lessons.length > 0 ? (
            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                      <p className="text-sm text-gray-500">
                        {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">Уроки будут добавлены скоро</p>
          )}
        </div>
      </div>
    </main>
  )
}