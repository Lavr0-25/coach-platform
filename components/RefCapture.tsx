'use client'

// №32 бэклога (2026-09-17): захват реферальной ссылки автора (?ref=<coach_user_id>).
// Висит в корневом layout: при первом заходе по ссылке запоминает код
// в localStorage — страницу регистрации читает его после signUp
// (app/actions/referral.ts, saveReferral). Хранится 30 дней.

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
// useSearchParams в корневом layout требует Suspense-границы (Next App Router)
// — обернуть при подключении: <Suspense fallback={null}><RefCapture /></Suspense>

const STORAGE_KEY = 'rw_ref'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

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
  }, [pathname, params])

  return null
}