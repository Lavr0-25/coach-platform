// Реестр видео-платформ: для каждой — одно правило «ссылка → embed-плеер».
// Добавить новую платформу = дописать одну запись в EMBED_BUILDERS.
// Ссылки, которые не распознались, возвращает null — вызывающий код показывает fallback.

type EmbedBuilder = (url: string) => string | null

const EMBED_BUILDERS: Record<string, EmbedBuilder> = {
  youtube: (url) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : null
  },

  vk: (url) => {
    const match = url.match(/(?:vkvideo\.(?:ru|com)|vk\.(?:com|ru))\/video(-?\d+)_(\d+)/)
    return match ? `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2` : null
  },

  rutube: (url) => {
    const match = url.match(/rutube\.ru\/video\/([a-z0-9]+)/i)
    return match ? `https://rutube.ru/play/embed/${match[1]}` : null
  },

  dzen: (url) => {
    const match = url.match(/dzen\.ru\/video\/watch\/([a-z0-9-]+)/i)
    return match
      ? `https://dzen.ru/embed/v?from=club&page=1&kind=short&url=${encodeURIComponent(`https://dzen.ru/video/watch/${match[1]}`)}`
      : null
  },
}

/**
 * Превращает ссылку на видео (любой поддерживаемой платформы)
 * в embed-ссылку для iframe. Не распознала — вернёт null.
 */
export function getVideoEmbedUrl(url: string | null): string | null {
  if (!url) return null
  for (const build of Object.values(EMBED_BUILDERS)) {
    const embedUrl = build(url)
    if (embedUrl) return embedUrl
  }
  return null
}