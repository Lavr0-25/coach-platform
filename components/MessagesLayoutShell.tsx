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
      {/* Убрали pt-20 md:pt-24 - отступы будут внутри компонентов */}
      <div className="flex flex-1 overflow-hidden relative min-h-0 bg-gray-50">
        
        {/* ЛЕВАЯ ПАНЕЛЬ - БЕЗ pt-20 md:pt-24 */}
        <div
          className={`
            bg-white flex-shrink-0 transition-all duration-300 ease-in-out border-r border-purple-100 flex flex-col
            ${isMobileChatOpen ? 'hidden md:flex' : 'flex w-full md:w-80'}
          `}
        >
          <div className="w-full md:w-80 flex-1 flex flex-col min-h-0 bg-white">
            <MessagesSidebar coaches={coaches} />
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white md:rounded-r-2xl md:shadow-sm md:border md:border-l-0 md:border-purple-100">
          
          {/* Мобильная шапка */}
          <div className="md:hidden flex items-center gap-3 p-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-20">
            <button 
              onClick={() => setIsMobileChatOpen(false)}
              className="p-2 -ml-2 text-gray-600 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900">Чат</span>
          </div>

          {/* Контент */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {children}
          </div>
        </div>

      </div>
    </MobileChatContext.Provider>
  )
}