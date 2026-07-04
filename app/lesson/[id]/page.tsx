import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface LessonPageProps {
  params: Promise<{
    id: string
  }>
}

// Функция нормализации URL для embed
function getEmbedUrl(url: string, contentType: string): string {
  if (!url) return ''
  
  // YouTube
  if (contentType === 'youtube') {
    // Преобразуем обычный URL YouTube в embed
    // https://www.youtube.com/watch?v=XXXXX → https://www.youtube.com/embed/XXXXX
    // https://youtu.be/XXXXX → https://www.youtube.com/embed/XXXXX
    if (url.includes('youtube.com/embed/')) return url
    if (url.includes('watch?v=')) {
      const videoId = url.split('watch?v=')[1]?.split('&')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    return url
  }
  
  // VK Video
  if (contentType === 'vk_video') {
    // Если это уже embed URL — возвращаем как есть
    if (url.includes('video_ext.php')) return url
    
    // Пытаемся извлечь oid и id из URL
    // https://vk.com/video-22822305_456239650
    // https://vk.ru/video-22822305_456239650
    const match = url.match(/video(-?\d+)_(\d+)/)
    if (match) {
      const oid = match[1]
      const videoId = match[2]
      return `https://vk.com/video_ext.php?oid=${oid}&id=${videoId}&hd=2`
    }
    
    // Если не смогли распарсить — показываем как ссылку
    return url
  }
  
  return url
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params
  
  const supabase = await createClient()

  // Загружаем урок
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
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

  if (lessonError || !lesson) {
    notFound()
  }

  // Загружаем контент урока
  const { data: content, error: contentError } = await supabase
    .from('lesson_content')
    .select('*')
    .eq('lesson_id', id)
    .order('order_index', { ascending: true })

  if (contentError) {
    console.error('Content error:', contentError)
  }

  // Отладка — увидишь в консоли сервера
  console.log('📺 Lesson content:', content)

  const isFree = lesson.price === 0 || lesson.is_free_preview

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/catalog" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к каталогу
        </Link>
      </div>

      {/* Карточка урока */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {lesson.title}
        </h1>
        
        {lesson.coaches && (
          <Link 
            href={`/mentor/${lesson.coaches.id}`}
            className="text-gray-600 hover:text-blue-600 mb-4 inline-block transition-colors"
          >
            👨‍🏫 {lesson.coaches.display_name}
            {lesson.coaches.specialization && ` — ${lesson.coaches.specialization}`}
          </Link>
        )}

        <div className="flex items-center gap-4">
          {isFree ? (
            <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-lg">
              🆓 Бесплатно
            </span>
          ) : (
            <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-lg">
              💰 {lesson.price} ₽
            </span>
          )}
          <span className="text-sm text-gray-500">
            📅 {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
          </span>
        </div>
      </div>

      {/* Видео контент */}
      {content && content.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🎬 Контент урока
          </h2>
          
          <div className="space-y-4">
            {content.map((item) => {
              const embedUrl = getEmbedUrl(item.content_url, item.content_type)
              
              if (item.content_type === 'youtube') {
                return (
                  <div key={item.id} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                )
              }
              
              if (item.content_type === 'vk_video') {
                // Если URL удалось преобразовать в embed — показываем iframe
                if (embedUrl.includes('video_ext.php')) {
                  return (
                    <div key={item.id} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      />
                    </div>
                  )
                }
                
                // Если не удалось — показываем ссылку
                return (
                  <div key={item.id} className="p-6 bg-blue-50 rounded-lg text-center">
                    <p className="text-gray-700 mb-4">
                      📹 Видео ВКонтакте
                    </p>
                    <a 
                      href={item.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block"
                    >
                      Открыть видео в новой вкладке
                    </a>
                  </div>
                )
              }
              
              if (item.content_type === 'yandex_disk') {
                return (
                  <div key={item.id} className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-gray-700 mb-2">📁 Файл на Яндекс.Диске:</p>
                    <a 
                      href={item.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline break-all"
                    >
                      {item.content_url}
                    </a>
                  </div>
                )
              }
              
              // Неизвестный тип — показываем ссылку
              return (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 mb-2">📄 {item.content_type}:</p>
                  <a 
                    href={item.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline break-all"
                  >
                    {item.content_url}
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Сообщение если нет контента */}
      {(!content || content.length === 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                Контент не добавлен
              </h3>
              <p className="text-yellow-800">
                У этого урока пока нет видео или файлов.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Описание */}
      {lesson.description && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📖 Описание
          </h2>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {lesson.description}
          </div>
        </div>
      )}
    </main>
  )
}