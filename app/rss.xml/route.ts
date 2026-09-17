import { createClient } from '@/lib/supabase/server'
import { withUtm } from '@/lib/utm'

// Канонический домен — www (апекс rightway.su редиректит на www.rightway.su)
const SITE_URL = 'https://www.rightway.su'

// №28: RSS-лента опубликованных материалов — задел под автозабор Дзена (№21).
// Дзен опрашивает ленту сам, поэтому частый пересбор не нужен.
export const revalidate = 3600

// Экранирование спецсимволов XML в текстах уроков (title/description).
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET() {
  const supabase = await createClient()

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, description, published_at, created_at, coaches(display_name)')
    .eq('is_published', true)
    .eq('is_hidden', false)
    .limit(50)

  // published_at может отсутствовать у старых публикаций — берём created_at.
  const items = (lessons ?? [])
    .map((l) => ({
      ...l,
      date: new Date(l.published_at ?? l.created_at),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 50)

  const lastBuild = items.length > 0 ? items[0].date : new Date()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Верный путь — платформа менторов</title>
<link>${SITE_URL}</link>
<description>Статьи и материалы менторов платформы «Верный путь»</description>
<language>ru</language>
<lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map((l) => {
    const url = withUtm(`${SITE_URL}/lesson/${l.id}`, 'rss')
    const author = Array.isArray(l.coaches) ? l.coaches[0]?.display_name : null
    return `<item>
<title>${esc(l.title)}</title>
<link>${url}</link>
<guid isPermaLink="true">${SITE_URL}/lesson/${l.id}</guid>
${l.description ? `<description>${esc(l.description)}</description>` : ''}
${author ? `<author>${esc(author)}</author>` : ''}
<pubDate>${l.date.toUTCString()}</pubDate>
</item>`
  })
  .join('\n')}
</channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}