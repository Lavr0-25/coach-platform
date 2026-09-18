// OG-карточка по умолчанию (1200×630) для материалов без обложки:
// градиент бренда + название + автор. Используется generateMetadata
// страниц /lesson, /course, /mentor, когда своей картинки нет — иначе
// соцсети показывают серую ссылку.
// Пример: /api/og?t=Название%20урока&a=Иван%20Петров

import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

const BRAND = '#6d5ce6' // фиолетовый RightWay

// Satori рендерит только с явно загруженными шрифтами — Inter (латиница +
// кириллица) из public/fonts, оба начертания (тексты жирные).
async function loadFonts() {
  try {
    const [regular, bold] = await Promise.all([
      readFile(path.join(process.cwd(), 'public', 'fonts', 'inter-400.ttf')),
      readFile(path.join(process.cwd(), 'public', 'fonts', 'inter-700.ttf')),
    ])
    return [
      { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
    ]
  } catch {
    // шрифты не найдены — ImageResponse отрисует дефолтным (латиница)
    return undefined
  }
}

// Satori — не HTML: экранируем то, что может прийти из названий материалов.
function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' })[c] || c
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('t') || 'Верный путь').slice(0, 90)
  const author = (searchParams.get('a') || '').slice(0, 60)
  const fonts = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 55%, #ddd6fe 100%)',
          fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: BRAND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            W
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#1e1b4b' }}>RightWay</div>
        </div>

        <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.2 }}>
          {esc(title)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 30, color: '#4c1d95' }}>{esc(author)}</div>
          <div style={{ fontSize: 26, color: '#6d28d9' }}>www.rightway.su</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
}