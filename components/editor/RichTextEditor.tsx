'use client'

// WYSIWYG-редактор текстовых уроков (Tiptap) «как в Дзене»:
// чистый текст, картинки между абзацами, видео-вставки YouTube/VK.
// Список расширений общий с сервером (lib/editor/lessonExtensions.ts) —
// редактируем только то, что сервер потом пропустит.

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { createClient } from '@/lib/supabase/client'
import { getLessonExtensions, parseVkUrl } from '@/lib/editor/lessonExtensions'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  lessonId?: string // для имени файла в Storage
}

// Кнопка тулбара. active подсвечивает включённый формат, disabled — недоступный
// в текущей позиции (например, «в заголовок» внутри заголовка).
function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`h-9 min-w-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? 'bg-purple-600 text-white'
          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
      } disabled:opacity-40 disabled:pointer-events-none`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, lessonId }: RichTextEditorProps) {
  const [insertPanel, setInsertPanel] = useState<'youtube' | 'vk' | null>(null)
  const [insertUrl, setInsertUrl] = useState('')
  const [insertError, setInsertError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: getLessonExtensions(),
    content: value || '',
    editorProps: {
      attributes: {
        class: 'lesson-prose-editor outline-none min-h-[300px] focus:outline-none',
        'aria-label': 'Текст урока',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  const openInsertPanel = (type: 'youtube' | 'vk') => {
    setInsertPanel(type)
    setInsertUrl('')
    setInsertError('')
  }

  const confirmInsert = () => {
    if (!editor || !insertPanel) return
    const url = insertUrl.trim()
    if (!url) return

    if (insertPanel === 'youtube') {
      // setYoutubeVideo сам проверяет адрес: не YouTube — команда вернёт false
      const ok = editor.chain().focus().setYoutubeVideo({ src: url }).run()
      if (!ok) {
        setInsertError('Не похоже на ссылку YouTube. Нужна ссылка вида https://youtube.com/watch?v=...')
        return
      }
    } else {
      if (!parseVkUrl(url)) {
        setInsertError('Не похоже на ссылку VK. Нужна ссылка вида https://vk.com/video-123_456')
        return
      }
      editor.chain().focus().setVkVideo(url).run()
    }
    setInsertPanel(null)
  }

  // Картинка: загружаем в Storage (как FileUploader), вставляем в позицию курсора
  const handleImageFile = async (file: File) => {
    if (!editor) return
    if (!file.type.startsWith('image/')) {
      setInsertError('Можно вставлять только изображения')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setInsertError('Картинка больше 10 МБ')
      return
    }
    setUploading(true)
    setInsertError('')
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'png'
      const path = `lesson_content_${lessonId || 'inline'}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('lesson_files')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('lesson_files').getPublicUrl(path)
      editor.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run()
    } catch (e) {
      console.error('Error uploading image:', e)
      setInsertError('Ошибка при загрузке картинки')
    } finally {
      setUploading(false)
    }
  }

  if (!editor) {
    // useEditor создаёт редактор после монтирования — на первый кадр показываем каркас
    return <div className="border border-purple-200 rounded-xl min-h-[320px] bg-white animate-pulse" />
  }

  return (
    <div className="border border-purple-200 rounded-xl bg-white">
      {/* Тулбар — липкий под шапкой (h-16) при прокрутке, кнопки переносятся на вторую строку.
          ВАЖНО: у контейнера нет overflow-hidden — он превращает sticky в «липание внутри себя» */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur border-b border-purple-100 rounded-t-xl px-2 py-2 flex flex-wrap gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Заголовок 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Заголовок 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Заголовок 3"
        >
          H3
        </ToolbarButton>
        <span className="w-px bg-purple-100 mx-1" aria-hidden />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Выровнять по левому краю"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <rect x="2" y="4" width="16" height="2" rx="1" />
            <rect x="2" y="9" width="10" height="2" rx="1" />
            <rect x="2" y="14" width="14" height="2" rx="1" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Выровнять по центру"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <rect x="2" y="4" width="16" height="2" rx="1" />
            <rect x="5" y="9" width="10" height="2" rx="1" />
            <rect x="3" y="14" width="14" height="2" rx="1" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Выровнять по правому краю"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <rect x="2" y="4" width="16" height="2" rx="1" />
            <rect x="8" y="9" width="10" height="2" rx="1" />
            <rect x="4" y="14" width="14" height="2" rx="1" />
          </svg>
        </ToolbarButton>
        <span className="w-px bg-purple-100 mx-1" aria-hidden />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Жирный (Ctrl+B)"
        >
          <span className="font-bold">Ж</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Курсив (Ctrl+I)"
        >
          <span className="italic font-serif">К</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Подчёркнутый (Ctrl+U)"
        >
          <span className="underline">Ч</span>
        </ToolbarButton>
        <span className="w-px bg-purple-100 mx-1" aria-hidden />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Список с точками"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="4" cy="5" r="1.6" /><rect x="8" y="4" width="9" height="2" rx="1" />
            <circle cx="4" cy="10" r="1.6" /><rect x="8" y="9" width="9" height="2" rx="1" />
            <circle cx="4" cy="15" r="1.6" /><rect x="8" y="14" width="9" height="2" rx="1" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Нумерованный список"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <text x="0" y="7" fontSize="7" fontWeight="bold">1.</text><rect x="8" y="4" width="9" height="2" rx="1" />
            <text x="0" y="16" fontSize="7" fontWeight="bold">2.</text><rect x="8" y="13" width="9" height="2" rx="1" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Цитата"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 5a4 4 0 00-4 4v6h6V9H5.5A2.5 2.5 0 018 6.5L7 5zm10 0a4 4 0 00-4 4v6h6V9h-3.5A2.5 2.5 0 0118 6.5L17 5z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Разделитель"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
            <path d="M3 10h14" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
        <span className="w-px bg-purple-100 mx-1" aria-hidden />
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title={uploading ? 'Загружаем...' : 'Вставить картинку'}
        >
          {uploading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
            </svg>
          )}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => openInsertPanel('youtube')}
          active={insertPanel === 'youtube'}
          title="Вставить видео YouTube"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23 12s0-3.4-.44-4.9a2.5 2.5 0 00-1.76-1.77C19.3 4.9 12 4.9 12 4.9s-7.3 0-8.8.43A2.5 2.5 0 001.44 7.1C1 8.6 1 12 1 12s0 3.4.44 4.9a2.5 2.5 0 001.76 1.77c1.5.43 8.8.43 8.8.43s7.3 0 8.8-.43a2.5 2.5 0 001.76-1.77C23 15.4 23 12 23 12zM9.8 15.5v-7l6 3.5-6 3.5z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => openInsertPanel('vk')}
          active={insertPanel === 'vk'}
          title="Вставить видео VK"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 17.5c-5.5 0-8.7-3.8-8.8-10h2.8c.1 4.5 2.1 6.4 3.7 6.8V7.5h2.6v3.9c1.6-.2 3.2-1.9 3.8-3.9h2.6c-.4 2.4-2 4.1-3.1 4.8 1.1.6 2.9 2 3.6 4.7h-2.9c-.5-1.8-1.9-3.2-3.9-3.4v3.4l-.7.5z" />
          </svg>
        </ToolbarButton>
        <span className="w-px bg-purple-100 mx-1" aria-hidden />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Отменить (Ctrl+Z)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Вернуть (Ctrl+Y)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v1m15-6l-4-4m4 4l-4 4" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Панель вставки видео по ссылке */}
      {insertPanel && (
        <div className="bg-purple-50 border-b border-purple-100 px-4 py-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {insertPanel === 'youtube' ? 'Ссылка на YouTube-видео' : 'Ссылка на видео VK'}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={insertUrl}
              onChange={(e) => setInsertUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmInsert() } }}
              placeholder={insertPanel === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://vk.com/video-123_456'}
              className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white transition-[box-shadow,border-color]"
              autoFocus
            />
            <button
              type="button"
              onClick={confirmInsert}
              className="gradient-btn text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
            >
              Вставить
            </button>
            <button
              type="button"
              onClick={() => setInsertPanel(null)}
              className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
          {insertError && <p className="text-xs text-red-600 mt-1.5">{insertError}</p>}
        </div>
      )}

      {/* Поле редактора. ProseCSS (.lesson-prose-editor) задаёт отступы абзацев */}
      <EditorContent editor={editor} className="px-4 sm:px-6 py-4" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // один и тот же файл можно вставить дважды
          if (file) handleImageFile(file)
        }}
      />
    </div>
  )
}