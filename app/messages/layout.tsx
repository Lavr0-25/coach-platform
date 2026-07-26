import { createClient } from '@/lib/supabase/server'
import MessagesLayoutShell from '@/components/MessagesLayoutShell'

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: allCoaches } = await supabase
    .from('coaches')
    .select('user_id, display_name, avatar_url, specialization')
    .order('display_name')

  return (
    // ИСПРАВЛЕНИЕ: используем fixed inset-0 вместо h-screen + pt
    // Это задаёт контейнер ровно от навбара до низа экрана
    <div className="fixed inset-0 pt-16 md:pt-20 overflow-hidden bg-gray-50">
      <MessagesLayoutShell coaches={allCoaches || []}>
        {children}
      </MessagesLayoutShell>
    </div>
  )
}