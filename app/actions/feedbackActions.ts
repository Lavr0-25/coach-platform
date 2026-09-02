'use server'

import { createClient } from '@/lib/supabase/server'

// Server Actions для истории обращений на /feedback.
// Проверка владельца — ЗДЕСЬ, на сервере (в базе пока нет RLS):
// фильтр .eq('user_id', user.id) в самом запросе — вторая ступень,
// чужая строка просто не найдётся. Редактировать и удалять можно
// только своё обращение и только пока оно в статусе «Новое» —
// после взятия в работу админом текст фиксируется.
// Результат — { ok } или { error }: форма показывает error без throw.

type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateMyFeedback(
  id: string,
  fields: {
    type: 'bug' | 'feature'
    title: string
    description: string
    images: string[] | null
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  // Правка разрешена только пока статус «Новое» — проверяем в самом запросе:
  // если админ взял обращение в работу между открытием формы и сохранением,
  // строка не обновится ни при каком раскладе.
  const { data, error: updateError } = await supabase
    .from('feedback')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id) // ← только своё обращение
    .eq('status', 'new') // ← только не взятое в работу
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Обращение не найдено или уже в работе — редактировать нельзя' }
  }
  return { ok: true }
}

export async function deleteMyFeedback(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Требуется вход' }

  // Сначала читаем скриншоты (нужны их пути в Storage для удаления),
  // потом удаляем строку тем же фильтром «своё + Новое».
  const { data: rows } = await supabase
    .from('feedback')
    .select('id, images')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'new')

  if (!rows || rows.length === 0) {
    return { ok: false, error: 'Обращение не найдено или уже в работе — удалить нельзя' }
  }

  const { error: deleteError } = await supabase
    .from('feedback')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'new')
    .select('id')

  if (deleteError) return { ok: false, error: deleteError.message }

  // Скриншоты удаляем из Storage вслед за обращением (чтобы бакет не копил
  // осиротевшие файлы). Это best-effort: если Storage не ответил,
  // обращение всё равно удалено — повторять нечего.
  const urls = (rows[0].images as string[] | null) || []
  const paths = urls
    .map((url) => url.split('/object/public/uploads/')[1])
    .filter((p): p is string => Boolean(p))
  if (paths.length > 0) {
    await supabase.storage.from('uploads').remove(paths)
  }

  return { ok: true }
}