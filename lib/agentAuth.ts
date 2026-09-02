import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Авторизация агентского API (вариант «ключи в базе», см. docs/specs/agent-api.md):
// 1. Ключ из заголовка x-agent-key хэшируем и ищем в таблице agent_keys
//    (через сервисный клиент — таблица закрыта RLS от всех).
// 2. Ключ найден и не отозван → входим в Supabase под пользователем-владельцем
//    ключа (magic link без письма) и возвращаем клиент с ЕГО правами.
// 3. Все запросы агента идут от этого пользователя через RLS — как если бы
//    он сам залогинился. Отзыв ключа в /admin/agent-keys отключает доступ.

export function hashAgentKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

type AgentAuth =
  | { client: SupabaseClient; userLabel: string; userId: string; role: string | null }
  | { error: Response }

export async function getAgentClient(request: Request): Promise<AgentAuth> {
  const admin = createAdminClient()
  if (!admin) {
    return {
      error: Response.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' },
        { status: 503 }
      ),
    }
  }

  const provided = request.headers.get('x-agent-key')
  if (!provided) {
    return { error: Response.json({ error: 'Отсутствует ключ (заголовок x-agent-key)' }, { status: 401 }) }
  }

  // Ищем ключ: хэши храним вместо самих ключей — утечка базы не раскрывает ключи
  const { data: keyRow, error: keyError } = await admin
    .from('agent_keys')
    .select('id, user_id')
    .eq('key_hash', hashAgentKey(provided))
    .is('revoked_at', null)
    .maybeSingle()

  if (keyError || !keyRow) {
    return { error: Response.json({ error: 'Неверный или отозванный ключ' }, { status: 401 }) }
  }

  // Отметку использования обновляем, но не превращаем в препятствие
  admin
    .from('agent_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {}, () => {})

  // Email владельца нужен, чтобы выписать ему одноразовый magic link
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(keyRow.user_id)
  const email = userData?.user?.email
  if (userError || !email) {
    return { error: Response.json({ error: 'Пользователь ключа не найден' }, { status: 401 }) }
  }

  // Вход под пользователем: одноразовый magic link без отправки письма
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return { error: Response.json({ error: 'Не удалось создать сессию для ключа' }, { status: 500 }) }
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (otpError) {
    return { error: Response.json({ error: 'Сессия ключа недействительна' }, { status: 500 }) }
  }

  // Роль владельца определяет, что агенту можно (см. endpoints: админ — полный доступ,
  // остальные — только чтение своих данных)
  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', keyRow.user_id)
    .maybeSingle()

  return { client: supabase, userLabel: email, userId: keyRow.user_id, role: coach?.role ?? null }
}