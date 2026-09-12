// /dashboard не был настоящей страницей (app/dashboard/ содержит только ai/ и
// mentor/) — но ссылки «В мой кабинет» есть на /payment/success|fail, proxy.ts
// и robots.ts, и вели на 404. Делаем лёгкий редирект: кто уже автор (строка в
// coaches есть у каждого зарегистрированного — триггер handle_new_user) —
// в кабинет наставника, остальные на главную.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardRedirectPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  redirect(coachRow ? '/dashboard/mentor' : '/')
}