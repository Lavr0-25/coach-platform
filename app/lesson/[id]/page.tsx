import { createClient } from '@/lib/supabase/server'
import { getVideoEmbedUrl } from '@/lib/video-embed'
import { sanitizeLessonHtml } from '@/lib/editor/sanitizeLessonHtml'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import FavoriteButton from '@/components/FavoriteButton'
import LessonProgress from '@/components/LessonProgress'

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

interface LessonPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Отслеживаем просмотр урока
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

  // Получаем данные урока
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select(`
      *,
      coaches (
        id,
        user_id,
        display_name,
        specialization,
        avatar_url
      ),
      lesson_content (
        id,
        content_type,
        content_url,
        content_html,
        order_index
      )
    `)
    .eq('id', id)
    .single()

  if (lessonError || !lesson) {
    notFound()
  }

  const coach = Array.isArray(lesson.coaches) ? lesson.coaches[0] : lesson.coaches
  const isOwner = user?.id === coach?.user_id

  // Черновик урока: виден только автору, остальным — 404.
  // Урок внутри курса не прячем: видимость курса определяется курсом.
  if (!lesson.is_published && !isOwner && !lesson.course_id) {
    notFound()
  }

  // Получаем контент урока
  const content = lesson.lesson_content?.[0]
  const isFree = lesson.price === 0 || lesson.is_free_preview

  // Проверяем покупку
  let isPurchased = false
  if (user && !isOwner && !isFree) {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('lesson_id', id)
      .eq('payment_status', 'completed')
      .single()
    isPurchased = !!purchase
  }

  const getContentTypeIcon = (contentType: string | null) => {
    const icons: Record<string, string> = {
      video: '🎬',
      youtube: '📺',
      vk_video: '📹',
      text: '📝',
      pdf: '📄',
      image: '🖼️',
      storage: '💾',
      other: '📎',
    }
    return icons[contentType || ''] || ''
  }

  const renderContent = () => {
    // Текстовый урок — свёрстанная статья. HTML уже очищен при сохранении,
    // но перестраховываемся и очищаем ещё раз при выводе (двойной замок).
    if (content?.content_type === 'text') {
      const html = sanitizeLessonHtml(content.content_html || '')
      if (html) {
        return (
          <article className="lesson-prose">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        )
      }
    }

    if (!content) {
      return (
        <div className="aspect-video bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4"></div>
            <p className="text-gray-600">Контент урока недоступен</p>
          </div>
        </div>
      )
    }

    const icon = getContentTypeIcon(content.content_type)

    // Ютуб/VK/Rutube/Дзен — определяем по самой ссылке и даём embed-плеер,
    // даже если тип в базе сохранён как 'video'
    const embedUrl = getVideoEmbedUrl(content.content_url)
    if (embedUrl) {
      return (
        <div className="aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          />
        </div>
      )
    }

    if (content.content_type === 'youtube' || content.content_type === 'video') {
      return (
        <div className="aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
          <video controls className="w-full h-full">
            <source src={content.content_url} />
            Ваш браузер не поддерживает видео
          </video>
        </div>
      )
    }

    if (content.content_type === 'pdf') {
      return (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-gray-600 mb-4">PDF документ</p>
          <a
            href={content.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Скачать PDF
          </a>
        </div>
      )
    }

    if (content.content_type === 'image') {
      return (
        <div className="rounded-xl overflow-hidden shadow-lg">
          <Image src={content.content_url} alt={lesson.title} width={1200} height={675} className="w-full h-auto" />
        </div>
      )
    }

    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <p className="text-gray-600 mb-4">Контент типа: {content.content_type}</p>
        <a
          href={content.content_url}
          target="_blank"
          rel="noopener noreferrer"
          className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
        >
          Открыть контент
        </a>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pt-24 sm:pt-28">
      {/* Верхняя панель */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>

        {isOwner && (
          <Link
            href={`/dashboard/mentor/lessons/${id}/edit`}
            className="bg-white text-purple-700 border border-purple-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-50 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Редактировать
          </Link>
        )}
      </div>

      {/* Заголовок урока */}
      <div className="style-card p-6 sm:p-8 mb-6 relative">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-4 leading-tight">
          {lesson.title}
        </h1>
        
        {coach && (
          <div className="mb-5">
            <Link href={`/mentor/${coach.id}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors group">
              {coach.avatar_url ? (
                <Image src={coach.avatar_url} alt={coach.display_name} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 gradient-icon rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {coach.display_name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
              <span className="font-semibold">{coach.display_name}</span>
              {coach.specialization && (
                <span className="text-gray-400">• {coach.specialization}</span>
              )}
            </Link>
          </div>
        )}

        {/* Статистика */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
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

          {/* Кнопка избранного — в общем ряду, без наложения на бейджи */}
          {!isOwner && (
            <FavoriteButton
              itemId={id}
              itemType="lesson"
              size="md"
            />
          )}
        </div>

        {/* Кнопки действий */}
        {!isOwner && !isFree && !isPurchased && (
          <div className="flex flex-wrap gap-3">
            {/* Платежи ещё не подключены: нейтральная кнопка вместо битой ссылки на /checkout */}
            <button
              disabled
              title="Оплата появится скоро"
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 opacity-60 cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Купить урок
            </button>
            <p className="text-sm text-gray-500 self-center">Онлайн-оплата появится скоро</p>
          </div>
        )}
      </div>

      {/* Контент урока */}
      {(isFree || isPurchased || isOwner) && (
        <div className="style-card p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              {getContentTypeIcon(content?.content_type)}
            </span>
            Содержание урока
          </h2>
          {renderContent()}
        </div>
      )}

      {/* Прогресс обучения (для анонима компонент сам скрывается) */}
      {(isFree || isPurchased || isOwner) && (
        <div className="mb-6">
          <LessonProgress lessonId={id} />
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

      {/* Комментарии */}
      <div className="mb-6 sm:mb-8">
        <LessonComments lessonId={id} />
      </div>
    </main>
  )
}