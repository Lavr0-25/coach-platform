'use server'

// Ф6.2 спеки payments.md — админская сторона «Заявки на платный контент»:
// одобрить (номер договора) / вернуть с причиной / включить-выключить
// продажи / загрузить финальный подписанный договор.
// Все решения пишутся в audit_log (таблица Ф1) — кто, что, когда, причина.
//
// Всё под админским токеном через createClient(): RLS-политики
// (paid_access_requests / mentor_agreements / mentor_agreement_files —
// admin all, coaches — coaches_admin_update, storage — админ на вставку)
// сами отсекают не-админа; гвард ниже — для понятных ошибок.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type AdminActionResult = { ok: boolean; error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILE_MB = 10

// Гвард: возвращает клиент и user_id админа либо ошибку
type AdminGuard = { ok: true; supabase: any; adminId: string } | { ok: false; error: string }

async function requireAdmin(): Promise<AdminGuard> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }
  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (coach?.role !== 'admin') return { ok: false, error: 'Недостаточно прав' }
  return { ok: true, supabase, adminId: user.id }
}

async function audit(
  supabase: any, // клиент под админским токеном (SupabaseClient)
  actorUserId: string,
  action: string,
  entity: string,
  entityId: string,
  details: Record<string, unknown>
) {
  await supabase.from('audit_log').insert({
    actor_user_id: actorUserId,
    action,
    entity,
    entity_id: entityId,
    details,
  })
}

// Одобрить заявку: статус approved + номер договора ЛД-ГГГГ-NNN на договор.
// Номер идёт подряд по году (max существующего + 1); у договора не должен
// уже быть номер (повторное одобрение другой заявки того же автора не
// перезатирает его).
export async function approvePaidAccessRequest(requestId: string): Promise<AdminActionResult> {
  if (!UUID_RE.test(requestId)) return { ok: false, error: 'Некорректный запрос' }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { data: req } = await supabase
    .from('paid_access_requests')
    .select('id, coach_user_id, status, inn')
    .eq('id', requestId)
    .maybeSingle()
  if (!req) return { ok: false, error: 'Заявка не найдена' }
  if (req.status !== 'submitted') return { ok: false, error: 'Заявка уже обработана' }

  // Активный договор обязателен: одобрять нечего без акцепта оферты
  const { data: agreement } = await supabase
    .from('mentor_agreements')
    .select('id, contract_number, status')
    .eq('coach_user_id', req.coach_user_id)
    .maybeSingle()
  if (!agreement || agreement.status !== 'active') {
    return { ok: false, error: 'У автора нет активного договора-оферты' }
  }

  // Номер: max по году + 1 (формат ЛД-2026-001)
  const year = new Date().getFullYear()
  const prefix = `ЛД-${year}-`
  const { data: existing } = await supabase
    .from('mentor_agreements')
    .select('contract_number')
    .like('contract_number', `ЛД-${year}-%`)
  const maxNum = (existing || []).reduce((m: number, r: { contract_number: string | null }) => {
    const n = parseInt(String(r.contract_number).split('-')[2] || '0', 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  const contractNumber = `${prefix}${String(maxNum + 1).padStart(3, '0')}`

  const { error: reqError } = await supabase
    .from('paid_access_requests')
    .update({ status: 'approved', decided_by: adminId, decided_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'submitted') // защита от гонки: уже обработанную не трогаем
  if (reqError) return { ok: false, error: 'Не удалось одобрить заявку' }

  if (!agreement.contract_number) {
    await supabase
      .from('mentor_agreements')
      .update({ contract_number: contractNumber })
      .eq('id', agreement.id)
  }

  await audit(supabase, adminId, 'paid_request_approved', 'paid_access_requests', requestId, {
    coach_user_id: req.coach_user_id,
    inn: req.inn,
    contract_number: agreement.contract_number || contractNumber,
  })

  revalidatePath('/admin/partner')
  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}

// Вернуть заявку с обязательной причиной — автор увидит её в кабинете
export async function returnPaidAccessRequest(
  requestId: string,
  reason: string
): Promise<AdminActionResult> {
  if (!UUID_RE.test(requestId)) return { ok: false, error: 'Некорректный запрос' }
  const trimmed = reason.trim()
  if (trimmed.length < 5) return { ok: false, error: 'Укажите причину возврата (от 5 символов)' }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { data: req } = await supabase
    .from('paid_access_requests')
    .select('id, coach_user_id, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!req) return { ok: false, error: 'Заявка не найдена' }
  if (req.status !== 'submitted') return { ok: false, error: 'Заявка уже обработана' }

  const { error } = await supabase
    .from('paid_access_requests')
    .update({
      status: 'returned',
      admin_comment: trimmed,
      decided_by: adminId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'submitted')
  if (error) return { ok: false, error: 'Не удалось вернуть заявку' }

  await audit(supabase, adminId, 'paid_request_returned', 'paid_access_requests', requestId, {
    coach_user_id: req.coach_user_id,
    reason: trimmed,
  })

  revalidatePath('/admin/partner')
  return { ok: true }
}

// Рубильник платных продаж. Включение — только при активном договоре и
// одобренной заявке; выключение — с причиной (в audit_log).
export async function setPaidPublishingAllowed(
  coachUserId: string,
  allow: boolean,
  reason?: string
): Promise<AdminActionResult> {
  if (!UUID_RE.test(coachUserId)) return { ok: false, error: 'Некорректный запрос' }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { data: agreement } = await supabase
    .from('mentor_agreements')
    .select('id, contract_number, status')
    .eq('coach_user_id', coachUserId)
    .maybeSingle()

  if (allow) {
    if (!agreement || agreement.status !== 'active') {
      return { ok: false, error: 'Нет активного договора — сначала одобрите заявку автора' }
    }
    const { data: approved } = await supabase
      .from('paid_access_requests')
      .select('id')
      .eq('coach_user_id', coachUserId)
      .eq('status', 'approved')
      .limit(1)
    if (!approved || approved.length === 0) {
      return { ok: false, error: 'Нет одобренной заявки — сначала одобрите заявку' }
    }
  } else if (!reason || reason.trim().length < 5) {
    return { ok: false, error: 'Укажите причину отключения продаж (от 5 символов)' }
  }
  const offReason = reason?.trim() ?? ''

  const { error } = await supabase
    .from('coaches')
    .update({ paid_publishing_allowed: allow })
    .eq('user_id', coachUserId)
  if (error) return { ok: false, error: 'Не удалось изменить статус продаж' }

  await audit(
    supabase,
    adminId,
    allow ? 'publishing_allowed_on' : 'publishing_allowed_off',
    'coaches',
    coachUserId,
    {
      contract_number: agreement?.contract_number || null,
      reason: allow ? null : offReason,
    }
  )

  revalidatePath('/admin/partner')
  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}

// Финальный подписанный договор: админ печатает, подписывает, сканирует,
// грузит PDF — автор увидит файл в кабинете (kind=final_signed).
export async function uploadFinalSignedFile(formData: FormData): Promise<AdminActionResult> {
  const requestId = String(formData.get('request_id') || '')
  const file = formData.get('file')
  if (!UUID_RE.test(requestId)) return { ok: false, error: 'Некорректный запрос' }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { data: req } = await supabase
    .from('paid_access_requests')
    .select('id, coach_user_id, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!req || req.status !== 'approved') {
    return { ok: false, error: 'Файл прикладывается к одобренной заявке' }
  }

  const { data: agreement } = await supabase
    .from('mentor_agreements')
    .select('id, status')
    .eq('coach_user_id', req.coach_user_id)
    .maybeSingle()
  if (!agreement || agreement.status !== 'active') {
    return { ok: false, error: 'Нет активного договора' }
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Выберите файл' }
  }
  if (file.type !== 'application/pdf') {
    return { ok: false, error: 'Только PDF' }
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return { ok: false, error: `Файл слишком большой — максимум ${MAX_FILE_MB} МБ` }
  }

  const path = `${req.coach_user_id}/${agreement.id}/final_${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('mentor-agreements')
    .upload(path, file, { contentType: 'application/pdf' })
  if (uploadError) return { ok: false, error: 'Не удалось загрузить файл — попробуйте ещё раз' }

  const { error: insertError } = await supabase.from('mentor_agreement_files').insert({
    agreement_id: agreement.id,
    coach_user_id: req.coach_user_id,
    kind: 'final_signed',
    storage_path: path,
    original_name: file.name,
    uploaded_by: adminId,
  })
  if (insertError) return { ok: false, error: 'Файл загружен, но не привязан — сообщите разработчику' }

  await audit(supabase, adminId, 'agreement_final_uploaded', 'mentor_agreement_files', agreement.id, {
    coach_user_id: req.coach_user_id,
    file_name: file.name,
  })

  revalidatePath('/admin/partner')
  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}

// Скачивание любого файла договора (скан автора или финальный): админ имеет
// право чтения по RLS storage; ссылка подписанная, живёт 10 минут.
export async function getAdminAgreementFileUrl(
  fileId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!UUID_RE.test(fileId)) return { ok: false, error: 'Некорректный запрос' }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase } = g

  const { data: fileRow } = await supabase
    .from('mentor_agreement_files')
    .select('storage_path')
    .eq('id', fileId)
    .maybeSingle()
  if (!fileRow) return { ok: false, error: 'Файл не найден' }

  const { data, error } = await supabase.storage
    .from('mentor-agreements')
    .createSignedUrl(fileRow.storage_path, 600)
  if (error || !data) return { ok: false, error: 'Не удалось получить ссылку на файл' }
  return { ok: true, url: data.signedUrl }
}

// ─── Ф6.3: факсимиле Платформы (№25) ──────────────────────────────────────
// Картинка «печать + роспись ООО „Проинфо"» хранится в публичном бакете brand
// под постоянным именем facsimile.png (замена = перезапись), публичный URL —
// в system_settings ключом facsimile_url. Ключа нет = факсимиле не загружено.
const FACSIMILE_PATH = 'facsimile.png'
const FACSIMILE_MAX_MB = 2

// Читаем публичный URL факсимиле (для карточки админки и /offer-mentor/print)
export async function getFacsimileUrl(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'facsimile_url')
    .maybeSingle()
  const url = typeof data?.value === 'string' ? data.value : null
  return url || null
}

export async function uploadFacsimile(formData: FormData): Promise<AdminActionResult> {
  const file = formData.get('file')

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Выберите файл' }
  }
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    return { ok: false, error: 'Только PNG или JPEG' }
  }
  if (file.size > FACSIMILE_MAX_MB * 1024 * 1024) {
    return { ok: false, error: `Файл слишком большой — максимум ${FACSIMILE_MAX_MB} МБ` }
  }

  const { error: uploadError } = await supabase.storage
    .from('brand')
    .upload(FACSIMILE_PATH, file, { contentType: file.type, upsert: true })
  if (uploadError) {
    return { ok: false, error: 'Не удалось загрузить картинку — попробуйте ещё раз' }
  }

  const { data } = supabase.storage.from('brand').getPublicUrl(FACSIMILE_PATH)
  if (!data?.publicUrl) {
    return { ok: false, error: 'Картинка загружена, но ссылка не получилась — сообщите разработчику' }
  }

  const { error: settingsError } = await supabase
    .from('system_settings')
    .upsert([{ key: 'facsimile_url', value: data.publicUrl }], { onConflict: 'key' })
  if (settingsError) {
    return { ok: false, error: 'Картинка загружена, но не включена — сообщите разработчику' }
  }

  await audit(supabase, adminId, 'facsimile_uploaded', 'system_settings', 'facsimile_url', {
    file_name: file.name,
    size: file.size,
  })

  revalidatePath('/admin/partner')
  revalidatePath('/offer-mentor/print')
  return { ok: true }
}

export async function removeFacsimile(): Promise<AdminActionResult> {
  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  const { error: storageError } = await supabase.storage.from('brand').remove([FACSIMILE_PATH])
  // Картинки может уже не быть (убрали ключ раньше / сбой загрузки) —
  // выключаем ключ в любом случае: он единственный источник «включено».
  // Выключение = пустое значение (DELETE-политики на system_settings нет,
  // читатели трактуют «ключа нет или пусто» одинаково: факсимиле выключено).
  const { error: settingsError } = await supabase
    .from('system_settings')
    .update({ value: '' })
    .eq('key', 'facsimile_url')
  if (settingsError) return { ok: false, error: 'Не удалось убрать факсимиле' }

  await audit(supabase, adminId, 'facsimile_removed', 'system_settings', 'facsimile_url', {
    storage_error: storageError?.message || null,
  })

  revalidatePath('/admin/partner')
  revalidatePath('/offer-mentor/print')
  return { ok: true }
}
// №33 бэклога (2026-09-17): индивидуальная ставка комиссии автора — реализация
// п. 5.3 оферты v1.2. Хранится в coaches.commission_rate (колонка есть с Ф1);
// расчёт её применяет с высшим приоритетом (lib/commission.ts). percent=null —
// «снять индивидуальную ставку» (вернуться к глобальной). Меняется только
// админом; автору уходит уведомление (п. 8.2 оферты: существенные изменения
// ставки — через кабинет).
export async function setCoachCommissionRate(
  coachUserId: string,
  percent: number | null
): Promise<AdminActionResult> {
  if (!UUID_RE.test(coachUserId)) return { ok: false, error: 'Некорректный запрос' }

  const g = await requireAdmin()
  if (!g.ok) return { ok: false, error: g.error }
  const { supabase, adminId } = g

  if (percent !== null) {
    const p = Number(percent)
    if (!Number.isFinite(p) || p < 0 || p > 90 || Math.round(p * 10) !== p * 10) {
      return { ok: false, error: 'Ставка — от 0 до 90, максимум один знак после запятой' }
    }
  }

  const { error } = await supabase
    .from('coaches')
    .update({ commission_rate: percent })
    .eq('user_id', coachUserId)
  if (error) return { ok: false, error: 'Не удалось сохранить ставку' }

  await audit(supabase, adminId, 'coach_commission_rate_set', 'coaches', coachUserId, {
    percent,
  })

  // Уведомление — только через сервисный ключ: у notifications нет
  // INSERT-политики (пишет «система»; тип 'commission' добавлен миграцией
  // 2026-09-17).
  const admin = createAdminClient()
  if (admin) {
    await admin.from('notifications').insert({
      user_id: coachUserId,
      type: 'commission',
      title: 'Ставка комиссии изменена',
      message:
        percent === null
          ? 'Индивидуальная ставка снята — действует стандартная ставка платформы (см. раздел «Партнёрская программа»).'
          : `Для вас установлена индивидуальная ставка: комиссия платформы ${percent}%. Подробности — в разделе «Партнёрская программа».`,
      link: '/dashboard/mentor/partner',
      is_read: false,
    })
  }

  revalidatePath('/admin/partner')
  revalidatePath('/dashboard/mentor/partner')
  return { ok: true }
}
