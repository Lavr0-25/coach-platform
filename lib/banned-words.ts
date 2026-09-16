import { createClient } from '@/lib/supabase/client'

// Дружелюбный первый барьер (UX): предупредить пользователя ДО отправки.
// Серверный триггер reject_banned_words — обязательная проверка, эта может
// соврать в сторону пропуска (REST в обход UI триггером ловится) или отказа.
//
// Логика — ЦЕЛЫЕ слова (текст режется на токены по не-буквам/цифрам),
// как в триггере и lib/bannedWords.ts: поиск подстроки ловил честные слова
// («бля» в «рубля», «манда» в «команда», «конча» в «кончается»).
export async function checkBannedWords(text: string): Promise<{ hasBanned: boolean; foundWord?: string }> {
  const supabase = createClient()

  const { data: bannedWords, error } = await supabase
    .from('banned_words')
    .select('word')

  if (error) {
    console.error('Error loading banned words:', error)
    return { hasBanned: false }
  }

  const tokens = new Set(
    text
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/)
      .filter(Boolean)
  )

  for (const item of bannedWords || []) {
    const word = (item.word || '').toLowerCase()
    if (word && tokens.has(word)) {
      return { hasBanned: true, foundWord: item.word }
    }
  }

  return { hasBanned: false }
}