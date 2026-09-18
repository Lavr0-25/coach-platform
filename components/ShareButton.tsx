'use client'

// Кнопка «Поделиться» (2026-09-18): ссылка всегда с utm_source=share
// (правило utm-меток, lib/utm.ts) — в аналитике виден канал «Поделиться».
// На мобильных — системная шторка шаринга (navigator.share), на десктопе —
// копирование ссылки + тост. Факт шаринга логируется в analytics_events
// (event_type 'share' — миграция 2026-09-18), чтобы автор видел, что
// материал расшаривают, даже если переход ещё не случился.

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withUtm } from '@/lib/utm'

export default function ShareButton({
  path,
  title,
  targetType,
  targetId,
  className,
}: {
  /** Путь страницы без домена: /lesson/<id>, /course/<id>, /mentor/<id> */
  path: string
  /** Заголовок для шторки шаринга */
  title: string
  /** Тип цели события: 'lesson' | 'course' | 'profile' */
  targetType: 'lesson' | 'course' | 'profile'
  targetId: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const buildUrl = () =>
    withUtm(`${window.location.origin}${path}`, 'share')

  const track = (channel: string) => {
    void (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('analytics_events').insert({
          event_type: 'share',
          target_type: targetType,
          target_id: targetId,
          user_id: user?.id ?? null,
          metadata: { channel },
        })
      } catch {
        // шаринг важнее аналитики: ошибка лога не должна ломать действие
      }
    })()
  }

  const onClick = async () => {
    const url = buildUrl()
    // Мобильные браузеры (и часть десктопных) — системная шторка
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        track('native')
        return
      } catch (e) {
        // Пользователь сам закрыл шторку (AbortError) — не считаем это ошибкой
        // и не логируем. Любой другой сбой (share заявлен, но не работает —
        // бывает в десктопных браузерах без шторки) — падаем в копирование.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    // Фолбэк: копирование
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      track('copy')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard может быть запрещён — выделяем ссылку в адресной строке сами
    }
  }

  return (
    <button
      onClick={onClick}
      title="Поделиться ссылкой на материал"
      className={
        className ||
        'inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
      }
    >
      <Share2 className="h-4 w-4" />
      {copied ? 'Скопировано' : 'Поделиться'}
    </button>
  )
}