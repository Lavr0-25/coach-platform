import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface CoursePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
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
    notFound()
  }

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', id)
    .order('order_index', { ascending: true })

  const lessonsCount = lessons?.length || 0

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
              👨‍ {course.coaches.display_name}
            </Link>
          )}

          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span>{lessonsCount} уроков</span>
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

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
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

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            👨‍🏫 Ваш наставник
          </h3>
          
          {course.coaches && (
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {course.coaches.display_name?.charAt(0).toUpperCase() || '👤'}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {course.coaches.display_name}
                </p>
                {course.coaches.specialization && (
                  <p className="text-sm text-gray-600">
                    {course.coaches.specialization}
                  </p>
                )}
              </div>
            </div>
          )}

          {course.coaches?.bio && (
            <p className="text-sm text-gray-700 leading-relaxed">
              {course.coaches.bio}
            </p>
          )}

          {course.coaches && (
            <Link
              href={`/mentor/${course.coaches.id}`}
              className="mt-4 block text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Смотреть профиль →
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
            </div>
            <p className="text-gray-600">
              {lessonsCount} {lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков'}
            </p>
          </div>

          <div className="space-y-3">
            {course.price === 0 ? (
              <Link
                href={`/lesson/${lessons?.[0]?.id || ''}`}
                className="block w-full bg-green-600 text-white text-center px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                 Начать обучение
              </Link>
            ) : (
              <>
                <button
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  onClick={() => alert('Функция оплаты будет добавлена позже')}
                >
                  💳 Купить курс
                </button>
                
                {lessons && lessons.length > 0 && (
                  <Link
                    href={`/lesson/${lessons[0].id}`}
                    className="block w-full bg-gray-100 text-gray-700 text-center px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    📖 Посмотреть первый урок
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="mt-6 pt-6 border-t">
            <h4 className="font-semibold text-gray-900 mb-3">
              Что входит в курс:
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>{lessonsCount} видео-уроков</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Доступ навсегда</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Материалы для скачивания</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Поддержка наставника</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}