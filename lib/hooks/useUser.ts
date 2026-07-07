import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const fetcher = async (query: string) => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('coaches')
    .select(query)
    .single()
  
  if (error) throw error
  return data
}

export function useUser(userId: string) {
  const { data, error, isLoading } = useSWR(
    userId ? `user_id=eq.${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 минута
    }
  )

  return {
    user: data,
    isLoading,
    isError: error,
  }
}