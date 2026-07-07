import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReviewsSection from '@/components/ReviewsSection'
import LessonComments from '@/components/LessonComments'
import LessonProgress from '@/components/LessonProgress'

interface LessonPageProps {
  params: Promise<{
    id: string
  }>
}

function FileDisplayCard({ 
  fileUrl, 
  fileType 
}: { 
  fileUrl: string
  fileType: string
}) {
  const getFileIcon = () => {
    if (fileType === 'pdf') return '📄'
    if (fileType === 'image') return '🖼️'
    if (fileType === 'yandex_disk') return '💾'
    if (fileType === 'presentation') return '📊'
    if (fileType === 'vk_video') return '📹'
    return '📎'
  }

  const getFileLabel = () => {
    if (fileType === 'pdf') return 'PDF документ'
    if (fileType === 'image') return 'Изображение'
    if (fileType === 'yandex_disk') return 'Яндекс.Диск'
    if (fileType === 'presentation') return 'Презентация'
    if (fileType === 'vk_video') return 'VK Видео'
    return 'Файл'
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl">
            {getFileIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {getFileLabel()}
          </h3>
          
          <div className="flex gap-3 mt-4">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Посмотреть
            </a>
            
            <a
              href={fileUrl}
              download
              className="inline-flex items-center gap-2 bg-white text-gray-700 border-2 border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Скачать
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function getEmbedUrl(url: string, contentType: string): string {
  if (!url) return ''
  
  if (contentType === 'youtube') {
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
  
  if (contentType === 'vk_video') {
    if (url.includes('video_ext.php')) return url
    
    const match = url.match(/video(-?\d+)_(\d+)/)
    if (match) {
      const oid = match[1]
      const videoId = match[2]
      return `https://vk.com/video_ext.php?oid=${oid}&id=${videoId}&hd=2`
    }
    
    return url
  }
  
  return url
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params
  
  const supabase = await createClient()

  // Отслеживаем просмотр урока
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'lesson_view',
        user_id: user.id,
        target_id: id,
        target_type: 'lesson',
      })
  }

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

  const coach = Array.isArray(lesson.coaches) ? lesson.coaches[0] : lesson.coaches

  const { data: content, error: contentError } = await supabase
    .from('lesson_content')
    .select('*')
    .eq('lesson_id', id)
    .order('order_index', { ascending: true })

  if (contentError) {
    console.error('Content error:', contentError)
  }

  const isFree = lesson.price === 0 || lesson.is_free_preview

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/catalog" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к каталогу
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {lesson.title}
        </h1>
        
        {coach && (
          <div className="mb-4">
            <Link 
              href={`/mentor/${coach.id}`}
              className="text-gray-600 hover:text-blue-600 transition-colors inline-flex items-center gap-2"
            >
              👨‍🏫 <span className="font-medium">{coach.display_name}</span>
              {coach.specialization && (
                <span className="text-gray-500">— {coach.specialization}</span>
              )}
            </Link>
          </div>
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

      {content && content.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🎬 Контент урока
          </h2>
          
          <div className="space-y-4">
            {content.map((item) => {
              if (item.content_type === 'youtube') {
                const embedUrl = getEmbedUrl(item.content_url, 'youtube')
                return (
                  <div key={item.id} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      title="YouTube video"
                    />
                  </div>
                )
              }
              
              if (item.content_type === 'vk_video') {
                const embedUrl = getEmbedUrl(item.content_url, 'vk_video')
                if (embedUrl.includes('video_ext.php')) {
                  return (
                    <div key={item.id} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        title="VK video"
                      />
                    </div>
                  )
                }
                
                return (
                  <FileDisplayCard
                    key={item.id}
                    fileUrl={item.content_url}
                    fileType="vk_video"
                  />
                )
              }
              
              if (item.content_type === 'pdf') {
                return (
                  <div key={item.id} className="space-y-4">
                    <FileDisplayCard
                      fileUrl={item.content_url}
                      fileType="pdf"
                    />
                    
                    <div className="border rounded-lg overflow-hidden">
                      <iframe
                        src={item.content_url}
                        className="w-full h-96"
                        title="PDF Preview"
                      />
                    </div>
                  </div>
                )
              }
              
              if (item.content_type === 'image') {
                return (
                  <div key={item.id} className="space-y-4">
                    <FileDisplayCard
                      fileUrl={item.content_url}
                      fileType="image"
                    />
                    
                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                      <img
                        src={item.content_url}
                        alt="Lesson content"
                        className="w-full h-auto max-h-[600px] object-contain mx-auto"
                      />
                    </div>
                  </div>
                )
              }
              
              if (item.content_type === 'yandex_disk' || item.content_type === 'presentation') {
                return (
                  <FileDisplayCard
                    key={item.id}
                    fileUrl={item.content_url}
                    fileType={item.content_type}
                  />
                )
              }
              
              return (
                <FileDisplayCard
                  key={item.id}
                  fileUrl={item.content_url}
                  fileType={item.content_type}
                />
              )
            })}
          </div>
        </div>
      )}

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

      {lesson.description && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📖 Описание
          </h2>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {lesson.description}
          </div>
        </div>
      )}

      {/* Прогресс урока */}
      <div className="mb-6">
        <LessonProgress lessonId={id} />
      </div>

      {/* Отзывы */}
      <div className="mb-6">
        <ReviewsSection lessonId={id} />
      </div>

      {/* Комментарии */}
      <div className="mb-6">
        <LessonComments lessonId={id} />
      </div>
    </main>
  )
}