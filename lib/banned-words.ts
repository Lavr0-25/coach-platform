import { createClient } from '@/lib/supabase/client'

export async function checkBannedWords(text: string): Promise<{ hasBanned: boolean; foundWord?: string }> {
  const supabase = createClient()
  
  const lowerText = text.toLowerCase()
  
  const { data: bannedWords, error } = await supabase
    .from('banned_words')
    .select('word')
  
  if (error) {
    console.error('Error loading banned words:', error)
    return { hasBanned: false }
  }
  
  for (const item of bannedWords || []) {
    if (lowerText.includes(item.word.toLowerCase())) {
      return { hasBanned: true, foundWord: item.word }
    }
  }
  
  return { hasBanned: false }
}