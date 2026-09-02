import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Приватные маршруты: доступ только для залогиненных.
// Проверка на сервере (до рендера), чтобы аноним не получал каркас страницы.
// Роли (ментор/админ) это НЕ проверяет — они остаются на самих страницах.
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/messages',
  '/favorites',
  '/notifications',
  '/feedback',
  '/mentor/analytics', // /mentor/<id> — публичная страница наставника, не трогаем
]

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}

// Прокси Next 16 (бывший middleware): выполняется до отрисовки каждой страницы.
// Обновляет сессию Supabase — без этого логин «пропадает» на серверных рендерах.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ВАЖНО: getUser(), а не getSession() — проверяет токен на сервере Supabase,
  // а не просто читает его из cookie (который мог истечь или быть подделан).
  const { data: { user } } = await supabase.auth.getUser()

  // Серверная защита приватных маршрутов: аноним → на /login до рендера страницы
  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Всё, кроме статики, картинок и файлов оптимизации изображений
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}