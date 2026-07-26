import { createClient } from '@/lib/supabase/server'
import MessagesLayoutShell from '@/components/MessagesLayoutShell'

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: allCoaches } = await supabase
    .from('coaches')
    .select('user_id, display_name, avatar_url, specialization')
    .order('display_name')

  return (
    // pt-16 md:pt-20 = высота навбара (64px / 80px)
    // h-screen + overflow-hidden = запрет скролла страницы
    <div className="h-screen overflow-hidden bg-gray-50 pt-16 md:pt-20">
      <MessagesLayoutShell coaches={allCoaches || []}>
        {children}
      </MessagesLayoutShell>
    </div>
  )
}