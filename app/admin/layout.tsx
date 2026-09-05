import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coach?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-24">
      {children}
    </div>
  )
}