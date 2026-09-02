// Общий набор расширений Tiptap для текстовых уроков.
// Используется в трёх местах — это гарантирует, что редактор, очистка (сервер)
// и рендер (сервер) понимают ровно одну и ту же разметку:
//   1. components/editor/RichTextEditor.tsx — сам редактор (клиент)
//   2. lib/editor/sanitizeLessonHtml.ts     — очистка HTML при сохранении (сервер)
//   3. app/lesson/[id]/page.tsx             — перестраховка при выводе (сервер)
import { Node, mergeAttributes } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { Youtube } from '@tiptap/extension-youtube'
import { TextAlign } from '@tiptap/extension-text-align'

// --- VK Видео -------------------------------------------------------------
// Готового расширения VK нет — делаем своё. Схема: блок-«атом» с одним
// атрибутом src (уже готовый embed-адрес), парсится с iframe[data-vk-video].
// Ссылки вида https://vk.com/video-123_456 и https://vkvideo.ru/video-123_456
// превращаем в embed-URL https://vk.com/video_ext.php?oid=...&id=...
export function parseVkUrl(url: string): string | null {
  const m = url.match(/(?:vk\.com|vkvideo\.ru)\/video(-?\d+)_(\d+)/)
  if (!m) return null
  return `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2`
}

export const VkVideo = Node.create({
  name: 'vkVideo',
  group: 'block',
  atom: true, // цельный блок: внутрь не попасть курсором, удаляется целиком

  addAttributes() {
    return {
      src: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'iframe[data-vk-video]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'iframe',
      mergeAttributes(HTMLAttributes, {
        'data-vk-video': '',
        allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
        allowfullscreen: true,
        class: 'lesson-video-embed',
      }),
    ]
  },

  addCommands() {
    return {
      setVkVideo:
        (url: string) =>
        ({ commands }) => {
          const embed = parseVkUrl(url)
          if (!embed) return false
          return commands.insertContent({ type: this.name, attrs: { src: embed } })
        },
    }
  },
})

// Типы для команды setVkVideo (чтобы TS знал про editor.commands.setVkVideo)
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    vkVideo: {
      setVkVideo: (url: string) => ReturnType
    }
  }
}

// --- Набор расширений урока -------------------------------------------------
export function getLessonExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false }, // ссылки в редакторе не открываем, только на просмотре
    }),
    Image.configure({ inline: false, allowBase64: false }), // картинки — отдельным блоком, только с URL (Storage)
    Youtube.configure({
      controls: true,
      nocookie: true, // youtube-nocookie.com — приватнее
      allowFullscreen: true,
      width: 800,
      height: 450,
    }),
    // Выравнивание абзацев и заголовков (style="text-align: ..."). Картинки —
    // отдельные блоки, всегда по центру (margin: auto в CSS), как в Дзене.
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    VkVideo,
  ]
}