'use server'

// Серверные actions админки: вся логика мутаций живёт на сервере.
// Клиент отправляет только «что сделать» — роль, автор и валидация проверяются здесь.
// Каждый action — самостоятельная точка входа (POST доступен любому),
// поэтому проверку роли НЕ выносим в декоратор «на потом»: assertAdmin вызывается в каждом.

import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: boolean; error?: string }

type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'rejected'

/** Проверка: сессия есть и роль — admin. Возвращает server-клиент или null. */
async function getAdminClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (coach?.role !== 'admin') return null
  return supabase
}

/** Срок бана в днях → ISO-дата. null = бессрочно. */
function daysToUnbannedAt(days: number | null): string | null {
  if (!days) return null
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

// ─── Блокировки (user_bans) ───────────────────────────────────────────────

export async function banUser(
  userId: string,
  reason: string,
  days?: number
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const trimmedReason = reason?.trim()
  if (!userId || !trimmedReason) return { ok: false, error: 'Укажите причину блокировки' }

  const { error } = await supabase.from('user_bans').insert({
    user_id: userId,
    banned_by: (await supabase.auth.getUser()).data.user!.id, // автор — из сессии, не от клиента
    reason: trimmedReason,
    unbanned_at: daysToUnbannedAt(days || null),
    is_active: true,
  })

  return error ? { ok: false, error: 'Ошибка при блокировке пользователя' } : { ok: true }
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const { error } = await supabase
    .from('user_bans')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)

  return error ? { ok: false, error: 'Ошибка при разблокировке' } : { ok: true }
}

// ─── Уроки ────────────────────────────────────────────────────────────────

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  // Порядок важен: контент ссылается на урок, сначала убираем его
  await supabase.from('lesson_content').delete().eq('lesson_id', lessonId)

  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  return error ? { ok: false, error: 'Ошибка при удалении урока' } : { ok: true }
}

export async function updateLesson(
  lessonId: string,
  data: { title: string; description: string; price: number; is_free_preview: boolean }
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const title = data.title?.trim()
  if (!lessonId || !title) return { ok: false, error: 'Название урока обязательно' }
  if (data.price < 0) return { ok: false, error: 'Цена не может быть отрицательной' }

  const { error } = await supabase
    .from('lessons')
    .update({ title, description: data.description ?? '', price: data.price, is_free_preview: !!data.is_free_preview })
    .eq('id', lessonId)

  return error ? { ok: false, error: 'Ошибка при обновлении урока' } : { ok: true }
}

// ─── Наставники ───────────────────────────────────────────────────────────

export async function setCoachVerified(coachId: string, verified: boolean): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const { error } = await supabase
    .from('coaches')
    .update({ is_verified: verified })
    .eq('id', coachId)

  return error
    ? { ok: false, error: verified ? 'Ошибка при одобрении наставника' : 'Ошибка при отмене проверки' }
    : { ok: true }
}

// ─── Жалобы ───────────────────────────────────────────────────────────────

export async function deleteReport(
  id: string,
  type: 'comment' | 'review'
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const table = type === 'comment' ? 'reports' : 'review_reports'
  const { error } = await supabase.from(table).delete().eq('id', id)

  return error ? { ok: false, error: 'Ошибка при удалении жалобы' } : { ok: true }
}

// ─── Стоп-лист ────────────────────────────────────────────────────────────

export async function upsertStopList(
  userId: string,
  reason: string,
  bannedUntil: string
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const trimmedReason = reason?.trim()
  if (!userId || !trimmedReason || !bannedUntil) {
    return { ok: false, error: 'Заполните все поля' }
  }

  const { error } = await supabase
    .from('stop_list')
    .upsert({ user_id: userId, reason: trimmedReason, banned_until: bannedUntil }, { onConflict: 'user_id' })

  return error ? { ok: false, error: 'Не удалось заблокировать' } : { ok: true }
}

export async function removeStopListEntry(id: string): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const { error } = await supabase.from('stop_list').delete().eq('id', id)
  return error ? { ok: false, error: 'Ошибка при разблокировке' } : { ok: true }
}

// ─── Обращения (feedback) ─────────────────────────────────────────────────

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  reply?: string
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (reply !== undefined) {
    payload.admin_reply = reply || null
    payload.replied_at = reply ? new Date().toISOString() : null
  }

  const { error } = await supabase.from('feedback').update(payload).eq('id', id)
  return error ? { ok: false, error: 'Ошибка при обновлении статуса' } : { ok: true }
}

export async function bulkUpdateFeedbackStatus(
  ids: string[],
  status: FeedbackStatus
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }
  if (!ids.length) return { ok: false, error: 'Ничего не выбрано' }

  const { error } = await supabase
    .from('feedback')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)

  return error ? { ok: false, error: 'Ошибка при массовом обновлении статуса' } : { ok: true }
}

// ─── Запрещённые слова ────────────────────────────────────────────────────

const MAX_BANNED_WORD_LEN = 100
const MAX_BANNED_WORDS_BATCH = 10000

export async function addBannedWord(word: string): Promise<ActionResult & { duplicate?: boolean }> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const trimmed = word?.trim().toLowerCase()
  if (!trimmed) return { ok: false, error: 'Введите слово' }
  if (trimmed.length > MAX_BANNED_WORD_LEN) return { ok: false, error: 'Слово слишком длинное' }

  const { error } = await supabase.from('banned_words').insert({ word: trimmed })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Это слово уже есть в списке', duplicate: true }
    return { ok: false, error: 'Не удалось добавить слово' }
  }
  return { ok: true }
}

/** Пакетная загрузка слов из файла: один insert с игнорированием дублей вместо сотни запросов. */
export async function addBannedWordsBatch(words: string[]): Promise<ActionResult & { added: number; exists: number }> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён', added: 0, exists: 0 }

  const uniqueWords = [...new Set(
    (words || [])
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0 && w.length <= MAX_BANNED_WORD_LEN)
  )]
  if (!uniqueWords.length) return { ok: false, error: 'Файл пуст или не содержит слов', added: 0, exists: 0 }
  if (uniqueWords.length > MAX_BANNED_WORDS_BATCH) {
    return { ok: false, error: `Слишком много слов (максимум ${MAX_BANNED_WORDS_BATCH})`, added: 0, exists: 0 }
  }

  const { data, error } = await supabase
    .from('banned_words')
    .upsert(uniqueWords.map(word => ({ word })), { onConflict: 'word', ignoreDuplicates: true })
    .select('word')

  // upsert + ignoreDuplicates: дубли тихо пропускаются, select возвращает только вставленные
  if (error) return { ok: false, error: 'Ошибка при загрузке файла', added: 0, exists: 0 }

  const added = data?.length || 0
  return { ok: true, added, exists: uniqueWords.length - added }
}

export async function deleteBannedWord(id: string): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  const { error } = await supabase.from('banned_words').delete().eq('id', id)
  return error ? { ok: false, error: 'Ошибка при удалении' } : { ok: true }
}

export async function clearBannedWords(): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  // neq по заведомо несуществующему id = «удалить все строки»
  const { error } = await supabase
    .from('banned_words')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  return error ? { ok: false, error: 'Ошибка при очистке' } : { ok: true }
}

// ─── Настройки системы ────────────────────────────────────────────────────

export async function saveSystemSettings(
  autoBanThreshold: number,
  autoBanDurationDays: number
): Promise<ActionResult> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: 'Доступ запрещён' }

  // Осмысленные границы: срабатывание от 1 жалобы, срок от 1 дня, без переполнения
  if (autoBanThreshold < 1 || autoBanThreshold > 100) return { ok: false, error: 'Порог: от 1 до 100' }
  if (autoBanDurationDays < 1 || autoBanDurationDays > 365) return { ok: false, error: 'Срок: от 1 до 365 дней' }

  const { error } = await supabase.from('system_settings').upsert([
    { key: 'auto_ban_threshold', value: autoBanThreshold.toString() },
    { key: 'auto_ban_duration_days', value: autoBanDurationDays.toString() },
  ], { onConflict: 'key' })

  return error ? { ok: false, error: 'Ошибка при сохранении настроек' } : { ok: true }
}