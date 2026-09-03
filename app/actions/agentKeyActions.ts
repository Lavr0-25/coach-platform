'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashAgentKey } from '@/lib/agentAuth'

// Server Actions для страницы «API-ключи агента» (/dashboard/ai/keys).
// Ключ может создать любой залогиненный пользователь; права агента определяются
// ролью владельца (админ — полный доступ, остальные — чтение своих данных).
// Таблица agent_keys закрыта RLS наглухо (политик нет), поэтому все операции —
// через сервисный клиент, но ПЕРЕД этим проверяем руками, что пользователь
// залогинен. Пользователь видит и отзывает только СВОИ ключи.

type ActionResult = { ok: true } | { ok: false; error: string }

export interface AgentKeyInfo {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

// Единая проверка доступа для всех действий с ключами
async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { userId: user.id, email: user.email ?? '' }
}

export async function createAgentKey(
  name: string
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const owner = await requireUser()
  if (!owner) return { ok: false, error: 'Требуется вход' }
  const supabaseAdmin = createAdminClient()
  if (!supabaseAdmin) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' }
  }

  // Сам ключ показываем один раз, в базе остаётся только хэш
  const key = randomBytes(24).toString('base64url')
  const { error } = await supabaseAdmin
    .from('agent_keys')
    .insert({
      key_hash: hashAgentKey(key),
      user_id: owner.userId,
      name: name.trim() || 'Ключ',
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true, key }
}

export async function listAgentKeys(): Promise<
  { ok: true; keys: AgentKeyInfo[] } | { ok: false; error: string }
> {
  const owner = await requireUser()
  if (!owner) return { ok: false, error: 'Требуется вход' }
  const supabaseAdmin = createAdminClient()
  if (!supabaseAdmin) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' }
  }

  // Только СВОИ ключи; сам ключ (и его хэш) не возвращаем никогда — только метаданные
  const { data, error } = await supabaseAdmin
    .from('agent_keys')
    .select('id, name, created_at, last_used_at, revoked_at')
    .eq('user_id', owner.userId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, keys: (data || []) as AgentKeyInfo[] }
}

export async function revokeAgentKey(id: string): Promise<ActionResult> {
  const owner = await requireUser()
  if (!owner) return { ok: false, error: 'Требуется вход' }
  const supabaseAdmin = createAdminClient()
  if (!supabaseAdmin) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' }
  }

  // Фильтр по владельцу в самом запросе: чужой ключ не отзовётся
  const { error } = await supabaseAdmin
    .from('agent_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', owner.userId)
    .is('revoked_at', null)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}