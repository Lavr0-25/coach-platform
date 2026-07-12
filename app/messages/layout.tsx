import { createClient } from '@/lib/supabase/server'
import MessagesSidebar from '@/components/MessagesSidebar'

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()  // ← Добавлен await здесь!

  const { data: allCoaches } = await supabase
    .from('coaches')
    .select('user_id, display_name, avatar_url, specialization')
    .order('display_name')

  return (
    <div className="h-full flex overflow-hidden bg-gray-100">
      <div className="w-80 border-r bg-white flex-shrink-0 h-full overflow-hidden">
        <MessagesSidebar
          coaches={allCoaches || []}
        />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  )
}