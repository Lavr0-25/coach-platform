'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isBot } from '@/lib/utm'

// Показы и клики карточек каталога (CTR, 2026-09-17): события пишутся в
// analytics_events — event_type 'catalog_impression' (карточка попала в
// видимую область экрана) и 'catalog_click' (клик по карточке до перехода).
// CTR материала = клики / показы. Отдельно от lesson_view, чтобы не
// смешивать клики из каталога с переходами по внешним ссылкам (ТГ/Дзен).

// «Один раз за сессию на карточку»: показ карточки при каждом скролле туда-
// сюда показом не считается. Метки живут в sessionStorage (переживают
// переходы между страницами, сбрасываются при новом открытии сайта).
const SEEN_KEY = 'catalog_impressions_seen'

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}

// user_id берём из сессии: у залогиненного событие проходит политику
// analytics_insert_own (user_id = auth.uid()), у гостя остаётся null.
// Слать user_id: null при залогиненном нельзя — RLS молча отклонит вставку
// (403-шум в консоли, метрики каталога от своих пользователей не писались).
async function insertEvent(eventType: string, type: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  supabase
    .from('analytics_events')
    .insert({
      event_type: eventType,
      user_id: user?.id ?? null,
      target_id: id,
      target_type: type,
      metadata: { source: 'catalog' },
    })
    .then(({ error }) => {
      if (error) console.error('catalog analytics:', error.message)
    })
}

/**
 * Обёртка карточки каталога: считает показ, когда карточка появилась
 * в видимой области экрана (IntersectionObserver, порог 0.5 — половина
 * карточки). Один показ за сессию на карточку, боты отфильтрованы.
 */
export function CatalogImpression({ type, id, children }: {
  type: 'lesson' | 'course'
  id: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isBot(navigator.userAgent)) return
    const key = `${type}:${id}`
    if (readSeen().has(key)) return
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        const seen = readSeen()
        seen.add(key)
        try {
          sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
        } catch {
          // приватный режим с запретом storage — показ просто не запомнится
        }
        insertEvent('catalog_impression', type, id)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [type, id])

  return <div ref={ref}>{children}</div>
}

/** Клик по карточке каталога — пишем до перехода (переход в SPA, запрос успевает уйти). */
export function trackCatalogClick(type: 'lesson' | 'course', id: string) {
  if (isBot(navigator.userAgent)) return
  insertEvent('catalog_click', type, id)
}