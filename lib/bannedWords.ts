import type { SupabaseClient } from '@supabase/supabase-js'

// Общие ворота качества для автопубликаций (уроки, соцсети и т.п.):
// запрещённые слова из banned_words — по всем текстовым полям сразу.
// Сравнение по целым словам, не по подстроке: подстрока ловила обычные слова
// («конча» в «кончать», «манда» в «команда», «бля» в «рубля», «млять» в
// «утомлять»). Список в banned_words хранит полные словоформы, поэтому
// точного совпадения токена достаточно.
// (Вынесено из app/api/agent/lessons/route.ts — общий код для нескольких
// агентских эндпоинтов, а не копия.)

export async function findBannedWord(
  client: SupabaseClient,
  texts: (string | null | undefined)[]
): Promise<string | null> {
  const { data: words, error } = await client.from('banned_words').select('word')
  if (error) return null // список недоступен — не блокируем (ошибку покажет отдельный вызов)
  const haystack = texts.filter(Boolean).join(' ').toLowerCase()
  const tokens = new Set(haystack.split(/[^a-zа-яё0-9]+/).filter(Boolean))
  for (const { word } of words || []) {
    if (word && tokens.has(word.toLowerCase())) return word
  }
  return null
}