'use server'

// Опрос разведки /survey: приём ответов анонимных респондентов.
// Спека: docs/specs/survey.md. Паттерн — app/actions/purchase.ts:
// вставка через сервисный ключ (createAdminClient), валидация руками
// (zod в проекте нет), ошибки — { ok: false, error }, не throw.
//
// Безопасность (RLS на survey_responses не даёт клиентам писать вообще):
//  - honeypot-поле: боты заполняют все поля — заполнено → тихий «успех» без записи;
//  - whitelist: каждый ответ проверяется по списку вопросов/вариантов;
//  - rate limit: не больше 3 отправок с одного ip_hash за 5 минут;
//  - сырой IP не храним (152-ФЗ) — только sha256(ip + SURVEY_SALT).

import { headers } from 'next/headers'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_QUESTIONS } from './questions'

export type SubmitSurveyResult = { ok: true } | { ok: false; error: string }

const MAX_TEXT_LEN = 2000

export async function submitSurvey(input: {
  answers: Record<string, unknown>
  honeypot?: string
}): Promise<SubmitSurveyResult> {
  // honeypot: клиент показывает поле пустым, боты вписывают туда что-то.
  if (typeof input?.honeypot === 'string' && input.honeypot.trim() !== '') {
    return { ok: true }
  }

  if (!input || typeof input.answers !== 'object' || input.answers === null) {
    return { ok: false, error: 'Некорректные данные' }
  }

  // Whitelist-валидация по каждому вопросу: на выходе — только значения,
  // совпадающие с вариантами/ограничениями questions.ts.
  const clean: Record<string, unknown> = {}
  for (const q of SURVEY_QUESTIONS) {
    const raw = input.answers[q.id]

    if (q.kind === 'text') {
      const value = typeof raw === 'string' ? raw.trim().slice(0, MAX_TEXT_LEN) : ''
      if (!value) {
        if (q.required) return { ok: false, error: 'Ответьте, пожалуйста, на все обязательные вопросы' }
        clean[q.id] = ''
        continue
      }
      clean[q.id] = value
      continue
    }

    if (q.kind === 'single') {
      const value = typeof raw === 'string' ? raw : ''
      if (!value || !q.options?.includes(value)) {
        if (q.required) return { ok: false, error: 'Ответьте, пожалуйста, на все обязательные вопросы' }
        clean[q.id] = ''
        continue
      }
      clean[q.id] = value
      continue
    }

    if (q.kind === 'multi') {
      const values = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
      const allowed = values.filter((v) => q.options?.includes(v))
      const unique = [...new Set(allowed)].slice(0, q.options?.length ?? 0)
      if (unique.length === 0 && q.required) {
        return { ok: false, error: 'Ответьте, пожалуйста, на все обязательные вопросы' }
      }
      clean[q.id] = unique
      continue
    }

    // scale 1–5
    const value = typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : 0
    if (!value) {
      if (q.required) return { ok: false, error: 'Ответьте, пожалуйста, на все обязательные вопросы' }
      clean[q.id] = 0
      continue
    }
    clean[q.id] = value
  }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Сервис временно недоступен — попробуйте позже' }

  // Анти-спам: не больше 3 отправок с одного отпечатка за 5 минут.
  // IP берём из заголовка прокси (Vercel отдаёт x-forwarded-for), хэшируем
  // с солью — сырой адрес в базу не попадает.
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const salt = process.env.SURVEY_SALT ?? 'rightway-survey-dev'
  const ipHash = createHash('sha256').update(ip + salt).digest('hex').slice(0, 32)

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since)
  if ((count ?? 0) >= 3) {
    return { ok: false, error: 'Слишком много отправок с этого адреса — попробуйте позже' }
  }

  const { error } = await admin.from('survey_responses').insert({
    answers: clean,
    ip_hash: ipHash,
    user_agent: (h.get('user-agent') ?? '').slice(0, 300),
  })
  if (error) {
    console.error('submitSurvey insert error:', error.message)
    return { ok: false, error: 'Не удалось сохранить ответы — попробуйте ещё раз' }
  }

  return { ok: true }
}