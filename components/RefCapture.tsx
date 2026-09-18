'use client'

// №32 бэклога (2026-09-17): захват реферальной ссылки автора (?ref=<coach_user_id>).
// Висит в корневом layout: при первом заходе по ссылке запоминает код
// в localStorage — страницу регистрации читает его после signUp
// (app/actions/referral.ts, saveReferral). Хранится 30 дней.

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveSource } from '@/lib/utm'
// useSearchParams в корневом layout требует Suspense-границы (Next App Router)
// — обернуть при подключении: <Suspense fallback={null}><RefCapture /></Suspense>

const STORAGE_KEY = 'rw_ref'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
// Метки «переход уже посчитан» — один referral_visit на код за сессию браузера
// (эффект перезапускается при смене pathname, без метки каждый заход на /?ref
// считался бы повторно). Сбрасывается при новом открытии сайта.
const SEEN_KEY = 'referral_visits_seen'

export default function RefCapture() {
  const pathname = usePathname()
  const params = useSearchParams()

  useEffect(() => {
    const ref = params.get('ref')
    if (!ref) return
    // Формат — uuid (coach_user_id); мусор не сохраняем, чтобы не копить шум.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: ref, at: Date.now() }))
    } catch {
      /* приватный режим браузера — обходимся без атрибуции */
    }

    // Статистика «Поделиться» (2026-09-18): фиксируем сам переход по
    // реферальной ссылке (событие referral_visit, миграция 2026-09-18).
    // target_id = код автора (coach_user_id) — SELECT-политика аналитики
    // отдаёт его автору как своё (target_type 'profile' = auth.uid()).
    try {
      const seen: string[] = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]')
      if (seen.includes(ref)) return
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ref]))
    } catch {
      /* storage недоступен — считаем каждый заход, некритично */
    }
    void (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('analytics_events').insert({
          event_type: 'referral_visit',
          user_id: user?.id ?? null,
          target_id: ref,
          target_type: 'profile',
          metadata: {
            source: resolveSource(params.get('utm_source'), document.referrer || null),
          },
        })
      } catch {
        // переход важнее аналитики: ошибка лога не должна мешать пользователю
      }
    })()
  }, [pathname, params])

  return null
}