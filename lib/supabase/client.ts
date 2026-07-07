import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000)
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            })
            return response
          } catch (error) {
            console.error('Supabase fetch error:', error)
            throw error
          } finally {
            clearTimeout(timeoutId)
          }
        },
      },
    }
  )
}