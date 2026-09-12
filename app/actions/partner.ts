'use server'

// Ф6.1 спеки payments.md: партнёрская программа ментора — акцепт оферты
// (лицензионный договор, текст /offer-mentor) и заявка на платный контент.
//
// Поток (гибрид, решение 12.09): ментор читает оферту → акцептует кнопкой
// (строка mentor_agreements, фиксируем дату/IP/браузер) → подаёт заявку
// (ИНН + опциональный скан подписанного договора в приватный бакет).
// Решение по заявке и включение продаж — только админ (admin-actions).
//
// Всё через серверный клиент под токеном ментора: RLS-политики таблиц
// разрешают INSERT только своих строк, поэтому клиентские права здесь —
// часть защиты, а не обход.

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type PartnerActionResult = { ok: boolean; error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// ИНН физлица (12 цифр) или организации (10 цифр) — CHECK той же формы в БД
const INN_RE = /^\d{10}$|^\d{12}$/
const OFFER_VERSION = '1.1'
const MAX_SCAN_MB = 10

// Акцепт оферты: фиксируем «кто, когда, откуда» — это подпись со стороны
// автора (п. 1.4 оферты). Повторный акцепт не создаёт дубль.
export async function acceptOfferAgreement(): Promise<PartnerActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: existing } = await supabase
    .from('mentor_agreements')
    .select('id, status')
    .eq('coach_user_id', user.id)
    .maybeSingle()
  if (existing?.status === 'active') {
    return { ok: true } // уже акцептовал — идемпотентно
  }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = h.get('user-agent')

  const { error } = await supabase.from('mentor_agreements').insert({
    coach_user_id: user.id,
    offer_version: OFFER_VERSION,
    signature_type: 'offer_acceptance',
    status: 'active',
    accept_ip: ip,
    accept_user_agent: ua,
  })
  if (error) return { ok: false, error: 'Не удалось зафиксировать акцепт — попробуйте ещё раз' }
  return { ok: true }
}

// Заявка на платный контент: ИНН + комментарий + опциональный скан договора.
// Скажем «нет» подаче до акцепта: без договора одобрять нечего.
export async function submitPaidAccessRequest(formData: FormData): Promise<PartnerActionResult> {
  const inn = String(formData.get('inn') || '').trim()
  const comment = String(formData.get('comment') || '').trim()
  const file = formData.get('scan')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  if (!INN_RE.test(inn)) {
    return { ok: false, error: 'ИНН должен состоять из 10 или 12 цифр' }
  }

  // Договор должен быть активен (акцепт уже сделан)
  const { data: agreement } = await supabase
    .from('mentor_agreements')
    .select('id, status')
    .eq('coach_user_id', user.id)
    .maybeSingle()
  if (!agreement || agreement.status !== 'active') {
    return { ok: false, error: 'Сначала примите условия договора-оферты' }
  }

  // Опциональный скан: PDF до 10 МБ (лимиты дублем стоят в бакете)
  let scanPath: string | null = null
  let scanName: string | null = null
  if (file instanceof File && file.size > 0) {
    if (file.type !== 'application/pdf') {
      return { ok: false, error: 'Скан договора — только в PDF' }
    }
    if (file.size > MAX_SCAN_MB * 1024 * 1024) {
      return { ok: false, error: `Скан слишком большой — максимум ${MAX_SCAN_MB} МБ` }
    }
    scanPath = `${user.id}/${agreement.id}/scan_${Date.now()}.pdf`
    scanName = file.name
    const { error: uploadError } = await supabase.storage
      .from('mentor-agreements')
      .upload(scanPath, file, { contentType: 'application/pdf' })
    if (uploadError) {
      return { ok: false, error: 'Не удалось загрузить скан — попробуйте ещё раз' }
    }
  }

  const { error: insertError } = await supabase.from('paid_access_requests').insert({
    coach_user_id: user.id,
    inn,
    mentor_comment: comment || null,
    status: 'submitted',
  })

  if (insertError) {
    // 23505 — уникальный индекс «одна открытая заявка»: уже на проверке
    if (String(insertError.code) === '23505' || insertError.message.includes('duplicate key')) {
      return { ok: false, error: 'У вас уже есть заявка на проверке' }
    }
    return { ok: false, error: 'Не удалось отправить заявку — попробуйте ещё раз' }
  }

  // Скан привязываем к договору отдельной записью (история версий)
  if (agreement && scanPath) {
    await supabase.from('mentor_agreement_files').insert({
      agreement_id: agreement.id,
      coach_user_id: user.id,
      kind: 'mentor_scan',
      storage_path: scanPath,
      original_name: scanName,
      uploaded_by: user.id,
    })
  }

  return { ok: true }
}

// Реквизиты для выплат (Ф6.2): отдельные поля — получатель, карта/счёт,
// банк, БИК. Нужны к первой выплате; до заполнения роялти копится и не
// сгорает (п. 6.2 оферты). Хранятся в закрытой таблице mentor_payout_details
// (у coaches SELECT публичный — реквизиты там хранить нельзя).
// Валидация: карта 16–19 цифр или счёт 20; БИК 9 цифр (необязателен —
// при переводе на карту не нужен).

export async function savePayoutDetails(formData: FormData): Promise<PartnerActionResult> {
  const holder = String(formData.get('holder_name') || '').trim()
  // номер карты/счёта храним без пробелов и дефисов
  const account = String(formData.get('account_no') || '').replace(/[\s-]/g, '')
  const bank = String(formData.get('bank_name') || '').trim()
  const bik = String(formData.get('bik') || '').trim()

  if (holder.length < 3 || holder.length > 150) {
    return { ok: false, error: 'Укажите получателя — ФИО (от 3 символов)' }
  }
  if (!/^\d{16,19}$|^\d{20}$/.test(account)) {
    return { ok: false, error: 'Номер карты — 16–19 цифр, счёта — 20 цифр (только цифры)' }
  }
  if (bank.length < 2 || bank.length > 100) {
    return { ok: false, error: 'Укажите банк (от 2 символов)' }
  }
  if (bik && !/^\d{9}$/.test(bik)) {
    return { ok: false, error: 'БИК — 9 цифр' }
  }
  // Счёт (20 цифр) без БИКа бухгалтер провести не сможет — требуем
  if (/^\d{20}$/.test(account) && !bik) {
    return { ok: false, error: 'Для перевода на счёт обязателен БИК (9 цифр)' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { error } = await supabase.from('mentor_payout_details').upsert(
    {
      coach_user_id: user.id,
      holder_name: holder,
      account_no: account,
      bank_name: bank,
      bik: bik || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_user_id' }
  )
  if (error) return { ok: false, error: 'Не удалось сохранить реквизиты — попробуйте ещё раз' }
  return { ok: true }
}

// Временная ссылка на скачивание файла договора (подписанный URL на 10 минут).
// RLS storage даёт читать объекты только владельцу папки и админу.
export async function getAgreementFileUrl(
  fileId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!UUID_RE.test(fileId)) return { ok: false, error: 'Некорректный запрос' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  const { data: fileRow } = await supabase
    .from('mentor_agreement_files')
    .select('storage_path, coach_user_id')
    .eq('id', fileId)
    .maybeSingle()
  if (!fileRow) return { ok: false, error: 'Файл не найден' }
  if (fileRow.coach_user_id !== user.id) return { ok: false, error: 'Нет доступа к файлу' }

  const { data, error } = await supabase.storage
    .from('mentor-agreements')
    .createSignedUrl(fileRow.storage_path, 600)
  if (error || !data) return { ok: false, error: 'Не удалось получить ссылку на файл' }
  return { ok: true, url: data.signedUrl }
}