import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import Navbar from '@/components/Navbar'

async function deleteLesson(formData: FormData) {
  'use server'
  const lessonId = formData.get('lessonId') as string
  const supabase = await createClient()
  await supabase.from('lessons').delete().eq('id', lessonId)
  revalidatePath('/dashboard/mentor/lessons')
}

export default async function MentorLessonsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach }: { data: any } = await supabase
    .from('coaches')
    .select('id, display_name, is_verified')
    .eq('user_id', user.id)
    .single()

  if (!coach) {
    redirect('/dashboard/mentor')
  }

  const { data: lessons }: { data: any[] | null } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      description,
      price,
      is_free_preview,
      created_at,
      lesson_content (
        content_type,
        content_url
      )
    `)
    .is('course_id', null)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Мои уроки</h1>
            <p className="text-gray-600">Управление вашими учебными материалами</p>
          </div>
          <Link
            href="/dashboard/mentor/lessons/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <span>+</span> Добавить урок
          </Link>
        </div>

        {lessons && lessons.length > 0 ? (
          <div className="space-y-4">
            {lessons.map((lesson) => {
              const content = lesson.lesson_content?.[0]
              const contentType = content?.content_type || 'unknown'
              const contentIcon: Record<string, string> = {
                youtube: '',
                vk_video: '',
                yandex_disk: '',
                pdf: '',
                image: '',
                presentation: '',
              }
              const icon = contentIcon[contentType] || ''

              return (
                <div
                  key={lesson.id}
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{icon}</span>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {lesson.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {lesson.is_free_preview && (
                              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                Бесплатный превью
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {lesson.description && (
                        <p className="text-gray-600 mb-3 ml-12">
                          {lesson.description}
                        </p>
                      )}
                      {content && (
                        <p className="text-sm text-gray-500 ml-12 break-all">
                          {content.content_url.length > 60 
                            ? content.content_url.substring(0, 60) + '...' 
                            : content.content_url}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm text-center"
                      >
                        Просмотр
                      </Link>
                      <Link
                        href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 text-sm text-center"
                      >
                        Редактировать
                      </Link>
                      <form action={deleteLesson}>
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <button
                          type="submit"
                          className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 text-sm w-full"
                        >
                          Удалить
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4"></div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Пока нет уроков
            </h2>
            <p className="text-gray-600 mb-6">
              Создайте свой первый урок, чтобы начать
            </p>
            <Link
              href="/dashboard/mentor/lessons/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <span>+</span> Создать урок
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}