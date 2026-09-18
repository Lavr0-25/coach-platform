// SEO-хелперы (фича Б, 2026-09-18; спека docs/specs/seo-indexing.md).

// OG-карточка-фолбэк: если у материала нет своей обложки/аватара, соцсети
// показывали бы серую ссылку. /api/og рисует карточку бренда с названием
// и автором. Относительный путь — metadataBase из layout превратит его
// в абсолютный URL https://www.rightway.su/api/og?...
export function ogCardUrl(title: string, author?: string | null): string {
  const p = new URLSearchParams({ t: title })
  if (author) p.set('a', author)
  return `/api/og?${p.toString()}`
}

// Ссылки внутри JSON-LD всегда абсолютные (поисковик их читает без страницы).
export function absoluteUrl(path: string): string {
  return `https://www.rightway.su${path}`
}