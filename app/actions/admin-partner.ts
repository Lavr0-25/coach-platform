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