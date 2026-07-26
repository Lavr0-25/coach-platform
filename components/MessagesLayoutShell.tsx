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
          
          {/* Мобильная шапка - показывается только когда чат открыт */}
          {isMobileChatOpen && (
            <div className="md:hidden flex items-center justify-between p-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMobileChatOpen(false)}
                  className="p-2 -ml-2 text-gray-600 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Список диалогов"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-semibold text-gray-900">Чат</span>
              </div>
            </div>
          )}

          {/* Контент чата - overflow-y-auto для мобильного скролла */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden overflow-y-auto">
            {children}
          </div>
        </div>

      </div>
    </MobileChatContext.Provider>
  )
}