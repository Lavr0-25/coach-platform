'use client'

import { useState, createContext, useContext } from 'react'
import MessagesSidebar from '@/components/MessagesSidebar'

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

const MobileChatContext = createContext<{
  isMobileChatOpen: boolean
  setIsMobileChatOpen: (open: boolean) => void
}>({
  isMobileChatOpen: false,
  setIsMobileChatOpen: () => {},
})

export const useMobileChat = () => useContext(MobileChatContext)

export default function MessagesLayoutShell({ children, coaches }: { children: React.ReactNode, coaches: Coach[] }) {
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)

  return (
    <MobileChatContext.Provider value={{ isMobileChatOpen, setIsMobileChatOpen }}>
      {/* flex-col на мобильном, flex-row на десктопе */}
      <div className="flex flex-col md:flex-row h-full w-full overflow-hidden">
        
        {/* ЛЕВАЯ ПАНЕЛЬ (сайдбар) */}
        <div
          className={`
            flex-shrink-0 border-r border-purple-100 flex flex-col overflow-hidden
            ${isMobileChatOpen ? 'hidden md:flex' : 'flex w-full md:w-80'}
          `}
        >
          <MessagesSidebar coaches={coaches} />
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ (чат) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
          {/* Мобильная шапка «Чат» убрана: кнопка «‹» теперь внутри шапки самого чата,
              чтобы на экране была одна полоса вместо двух */}

          {/* Контент чата - overflow-y-auto для мобильного скролла */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden overflow-y-auto">
            {children}
          </div>
        </div>

      </div>
    </MobileChatContext.Provider>
  )
}