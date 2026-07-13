import { createClient } from '@/lib/supabase/server'
import MessagesLayoutShell from '@/components/MessagesLayoutShell'

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: allCoaches } = await supabase
    .from('coaches')
    .select('user_id, display_name, avatar_url, specialization')
    .order('display_name')

  return (
    <div className="flex flex-col h-full min-h-0">
      <MessagesLayoutShell coaches={allCoaches || []}>
        {children}
      </MessagesLayoutShell>
    </div>
  )
}