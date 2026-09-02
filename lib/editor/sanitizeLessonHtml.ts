// Серверная очистка HTML текстового урока (защита от XSS).
//
// Идея: вместо самодельного «вырезать теги» используем сам Tiptap как санитайзер.
// generateJSON парсит произвольный HTML через схему редактора — всё, чего нет
// в схеме (script, style, onclick, javascript:-ссылки, чужие iframe),
// просто отбрасывается, потому что схеме оно не соответствует. Затем
// generateHTML собирает из очищенного JSON новый HTML.
// Проверено: <script>, onclick/onerror, javascript:, сторонние iframe — удаляются;
// легитимные h1/strong/img — сохраняются (тест 2026-09-02, см. спеку уроков).
//
// ⚠️ Только для сервера: '@tiptap/html/server' требует happy-dom и не должен
// попадать в клиентский бандл. Импортируется из server actions и server components.
import { generateJSON, generateHTML } from '@tiptap/html/server'
import { getLessonExtensions } from './lessonExtensions'

export function sanitizeLessonHtml(html: string): string {
  const trimmed = (html || '').trim()
  if (!trimmed) return ''

  let json
  try {
    json = generateJSON(trimmed, getLessonExtensions())
  } catch {
    // Разобрать не удалось (кривая разметка) — сохраняем пусто, а не «как есть»
    return ''
  }

  const clean = generateHTML(json, getLessonExtensions())
  // Пустой документ Tiptap выглядит как <p></p> — считаем это пустотой
  return clean === '<p></p>' ? '' : clean
}