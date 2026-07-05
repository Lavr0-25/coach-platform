import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StopListLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Проверяем, является ли пользователь админом
  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (coach?.role !== 'admin') {
    redirect('/')
  }

  return <>{children}</>
}