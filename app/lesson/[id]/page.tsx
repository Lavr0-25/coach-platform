import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Ленивая загрузка тяжёлых компонентов
const ReviewsSection = dynamic(
  () => import('@/components/ReviewsSection'),
  { 
    loading: () => (
      <div className="style-card p-6 animate-pulse space-y-4">
        <div className="h-8 bg-purple-100 rounded w-1/4"></div>
        <div className="h-24 bg-purple-100 rounded"></div>
      </div>
    )
  }
)

const LessonComments = dynamic(
  () => import('@/components/LessonComments'),
  { 
    loading: () => (
      <div className="style-card p-6 animate-pulse space-y-4">
        <div className="h-8 bg-purple-100 rounded w-1/4"></div>
        <div className="h-32 bg-purple-100 rounded"></div>
      </div>
    )
  }
)

const LessonProgress = dynamic(
  () => import('@/components/LessonProgress'),
  { 
    loading: () => <div className="animate-pulse h-24 bg-purple-100 rounded-xl"></div>
  }
)

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
    if (fileType === 'pdf') return ''
    if (fileType === 'image') return '🖼️'
    if (fileType === 'yandex_disk') return ''
    if (fileType === 'presentation') return '📊'
    if (fileType === 'vk_video') return '🎬'
    if (fileType === 'storage') return ''
    if (fileType === 'other') return '🔗'
    return '📎'
  }

  const getFileLabel = () => {
    if (fileType === 'pdf') return 'PDF документ'
    if (fileType === 'image') return 'Изображение'
    if (fileType === 'yandex_disk') return 'Яндекс.Диск'
    if (fileType === 'presentation') return 'Презентация'
    if (fileType === 'vk_video') return 'VK Видео'
    if (fileType === 'storage') return 'Файловое хранилище'
    if (fileType === 'other') return 'Внешняя ссылка'
    return 'Файл'
  }

  // Определяем, какие кнопки показывать
  const showDownloadButton = fileType === 'pdf' || fileType === 'image'
  const showViewButton = fileType === 'pdf' || fileType === 'image' || fileType === 'video'
  const showLinkButton = fileType === 'storage' || fileType === 'other'

  return (
    <div className="style-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-icon rounded-xl flex items-center justify-center text-3xl sm:text-4xl shadow-lg">
            {getFileIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0 w-full">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {getFileLabel()}
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
            {/* Кнопка "Посмотреть" - для видео, PDF и изображений */}
            {showViewButton && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gradient-btn text-white px-5 py-2.5 rounded-xl font-medium text-center flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {fileType === 'video' ? 'Смотреть видео' : 'Посмотреть'}
              </a>
            )}
            
            {/* Кнопка "Скачать" - только для PDF и изображений */}
            {showDownloadButton && (
              <a
                href={fileUrl}
                download
                className="bg-white text-purple-700 border-2 border-purple-200 px-5 py-2.5 rounded-xl font-medium hover:bg-purple-50 hover:border-purple-300 transition-all text-center flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Скачать
              </a>
            )}

            {/* Кнопка "Перейти по ссылке" - для хранилищ и других ссылок */}
            {showLinkButton && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gradient-btn text-white px-5 py-2.5 rounded-xl font-medium text-center flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Перейти по ссылке
              </a>
            )}
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
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl">
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>
      </div>

      {/* Заголовок урока с обложкой */}
      <div className="style-card p-6 sm:p-8 mb-6">
        {/* Обложка урока */}
        {lesson.cover_image ? (
          <div className="mb-6">
            <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
              <img
                src={lesson.cover_image}
                alt={lesson.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="aspect-video gradient-icon rounded-xl flex items-center justify-center">
              <div className="text-8xl opacity-50">📚</div>
            </div>
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-4 leading-tight">
          {lesson.title}
        </h1>
        
        {coach && (
          <div className="mb-5">
            <Link 
              href={`/mentor/${coach.id}`}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors group"
            >
              <div className="w-8 h-8 gradient-icon rounded-full flex items-center justify-center text-white text-sm font-bold">
                {coach.display_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <span className="font-semibold">{coach.display_name}</span>
              {coach.specialization && (
                <span className="text-gray-400">• {coach.specialization}</span>
              )}
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {isFree ? (
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-md shadow-green-500/20">
              Бесплатно
            </span>
          ) : (
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-md shadow-purple-500/20">
              {lesson.price} ₽
            </span>
          )}
          <span className="text-sm text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(lesson.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Контент урока */}
      {content && content.length > 0 && (
        <div className="style-card p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Материалы урока
          </h2>
          
          <div className="space-y-6">
            {content.map((item) => {
              // Для видео - встраиваем плеер
              if (item.content_type === 'youtube' || item.content_type === 'vk_video' || item.content_type === 'video') {
                const embedUrl = getEmbedUrl(item.content_url, item.content_type)
                if (embedUrl.includes('video_ext.php') || embedUrl.includes('youtube.com/embed')) {
                  return (
                    <div key={item.id} className="aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        title="Video content"
                      />
                    </div>
                  )
                }
                
                // Если это просто ссылка на видео - показываем карточку с кнопкой
                return (
                  <FileDisplayCard
                    key={item.id}
                    fileUrl={item.content_url}
                    fileType="video"
                  />
                )
              }
              
              // Для PDF
              if (item.content_type === 'pdf') {
                return (
                  <div key={item.id} className="space-y-4">
                    <FileDisplayCard
                      fileUrl={item.content_url}
                      fileType="pdf"
                    />
                    
                    <div className="border border-purple-100 rounded-xl overflow-hidden shadow-sm bg-white">
                      <iframe
                        src={item.content_url}
                        className="w-full h-96"
                        title="PDF Preview"
                      />
                    </div>
                  </div>
                )
              }
              
              // Для изображений
              if (item.content_type === 'image') {
                return (
                  <div key={item.id} className="space-y-4">
                    <FileDisplayCard
                      fileUrl={item.content_url}
                      fileType="image"
                    />
                    
                    <div className="border border-purple-100 rounded-xl overflow-hidden shadow-sm bg-white p-2">
                      <img
                        src={item.content_url}
                        alt="Lesson content"
                        className="w-full h-auto max-h-[600px] object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )
              }
              
              // Для файлового хранилища и других ссылок
              if (item.content_type === 'storage' || item.content_type === 'other') {
                return (
                  <FileDisplayCard
                    key={item.id}
                    fileUrl={item.content_url}
                    fileType={item.content_type}
                  />
                )
              }
              
              // Для всего остального - показываем как файл
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

      {/* Пустой контент */}
      {(!content || content.length === 0) && (
        <div className="style-card p-6 mb-6 border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
              ⚠️
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">
                Материалы пока не добавлены
              </h3>
              <p className="text-gray-600">
                Автор ещё не загрузил видео или файлы для этого урока. Загляните позже!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Описание */}
      {lesson.description && (
        <div className="style-card p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Описание
          </h2>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base sm:text-lg">
            {lesson.description}
          </div>
        </div>
      )}

      {/* Прогресс урока */}
      <div className="mb-6 sm:mb-8">
        <LessonProgress lessonId={id} />
      </div>

      {/* Отзывы */}
      <div className="mb-6 sm:mb-8">
        <ReviewsSection lessonId={id} />
      </div>

      {/* Комментарии */}
      <div className="mb-6 sm:mb-8">
        <LessonComments lessonId={id} />
      </div>
    </main>
  )
}