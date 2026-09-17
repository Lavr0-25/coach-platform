// №30 (правило Анатолия, 2026-09-16): все внешние ссылки на материалы
// платформы несут utm_source, чтобы аналитика показывала, откуда пришёл
// читатель (воронка каналов: Telegram → Дзен → vc.ru → VK → поиск).

// Каналы публикации платформы — имена utm_source.
export const UTM_SOURCES = {
  telegram: 'telegram',
  dzen: 'dzen',
  vc: 'vc',
  vk: 'vk',
  yandex: 'yandex',
  rss: 'rss',
  direct: 'direct',
} as const

/**
 * Добавляет (или заменяет) utm_source в ссылке. Дополнительно можно задать
 * utm_campaign — например, slug статьи, чтобы связать переходы с публикацией.
 */
export function withUtm(url: string, source: string, campaign?: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('utm_source', source)
    if (campaign) u.searchParams.set('utm_campaign', campaign)
    return u.toString()
  } catch {
    // относительная/битая ссылка — возвращаем как есть
    return url
  }
}

// Человекочитаемые имена источников для интерфейса.
const SOURCE_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  dzen: 'Дзен',
  yandex: 'Яндекс',
  google: 'Google',
  vk: 'VK',
  vc: 'vc.ru',
  rss: 'RSS',
  direct: 'Прямая',
  other: 'Другое',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source
}

/**
 * Определяет источник перехода: сначала utm_source из URL (наши ссылки),
 * затем referer-заголовок (органический Яндекс/Дзен/TG и чужие сайты),
 * иначе «Прямая».
 */
export function resolveSource(utm?: string | null, referer?: string | null): string {
  const utmClean = utm?.trim().toLowerCase()
  if (utmClean) return utmClean
  const r = (referer || '').toLowerCase()
  if (!r) return UTM_SOURCES.direct
  if (r.includes('t.me') || r.includes('telegram')) return UTM_SOURCES.telegram
  if (r.includes('dzen.ru')) return UTM_SOURCES.dzen
  if (r.includes('yandex') || r.includes('ya.ru')) return UTM_SOURCES.yandex
  if (r.includes('google.')) return 'google'
  if (r.includes('vk.com') || r.includes('vk.ru')) return UTM_SOURCES.vk
  if (r.includes('vc.ru')) return UTM_SOURCES.vc
  return 'other'
}

// Типовые User-Agent краулеров — их просмотры в охваты не считаем.
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview/i

export function isBot(userAgent?: string | null): boolean {
  return BOT_RE.test(userAgent || '')
}