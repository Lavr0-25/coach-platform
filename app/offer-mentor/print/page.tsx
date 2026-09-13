'use client'

// Персональная версия договора для подписания: те же условия, что в публичной
// оферте, но с вписанными данными автора (имя, ИНН) и местом для подписи.
// Открывается из заявки на платные продажи в кабинете (кнопка активна, когда
// ИНН введён); печать/сохранение в PDF — вручную кнопкой на странице.
// Данные передаются в адресной строке (это данные самого автора, не секрет).
// Ф6.3: если автор просил факсимиле галочкой в заявке, эта заявка одобрена и
// админ загрузил картинку — в блоке подписи стоит факсимиле Платформы (№25).
// Флаг хранится в самой заявке (paid_access_requests): автор создаёт её
// INSERT'ом, отдельных прав на обновление договора у него нет.

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OfferMentorContent } from '@/components/OfferMentorContent'
import { Printer } from 'lucide-react'

function PrintView() {
  const params = useSearchParams()
  const supabase = createClient()
  const inn = params.get('inn')
  const authorName = params.get('name')

  // Условия показа факсимиле (см. шапку): запрос автора + одобренная заявка +
  // картинка загружена админом. Данные собственные (RLS автора) или публичные.
  const [facsimileUrl, setFacsimileUrl] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !inn) return

      const [reqRes, facRes] = await Promise.all([
        supabase
          .from('paid_access_requests')
          .select('facsimile_requested')
          .eq('coach_user_id', user.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('system_settings').select('value, updated_at').eq('key', 'facsimile_url').maybeSingle(),
      ])

      const requested = Boolean(
        (reqRes.data as { facsimile_requested?: boolean }[] | null)?.[0]?.facsimile_requested
      )
      const facRow = (facRes.data as { value?: unknown; updated_at?: string } | null) || null
      const url = typeof facRow?.value === 'string' && facRow.value ? facRow.value : null
      if (requested && url) {
        // ?v= — кэш-бастер: после замены картинки браузер не показывает старую
        setFacsimileUrl(`${url}?v=${facRow?.updated_at || ''}`)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inn])

  // Диалог печати НЕ запускаем автоматически: автор смотрит текст (со своими
  // данными), затем сохраняет в PDF кнопкой сам.

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl pt-24 sm:pt-28 print:pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Договор для подписания
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Версия с вашими данными: сохраните в PDF, распечатайте, подпишите.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium flex-shrink-0"
        >
          <Printer className="w-4 h-4" strokeWidth={1.5} />
          Сохранить в PDF
        </button>
      </div>

      <OfferMentorContent authorName={authorName} inn={inn} facsimileUrl={facsimileUrl} />
    </div>
  )
}

export default function OfferPrintPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-gray-500">Загрузка…</div>}>
      <PrintView />
    </Suspense>
  )
}