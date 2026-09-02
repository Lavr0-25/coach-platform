import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Возврат из письма (восстановление пароля, подтверждение email) по PKCE:
// Supabase присылает нас сюда с ?code=..., обмениваем его на сессию.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // куда отправить пользователя после входа (по умолчанию — на смену пароля)
  const next = searchParams.get('next') ?? '/reset-password'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Кода нет или обмен не удался — на вход с подсказкой
  return NextResponse.redirect(`${origin}/login?error=auth`)
}