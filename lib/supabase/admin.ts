import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// Сервисный клиент Supabase: идёт с ключом service_role и ОБХОДИТ RLS.
// Использовать только для узких служебных операций, где проверка прав сделана
// руками в коде (сейчас это agent_keys: хэши ключей и вход агента под пользователем).
// Для обычных запросов — createClient() из lib/supabase/server, там права режет RLS.

export function createAdminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}