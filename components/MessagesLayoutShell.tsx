'use client'

import { useState, createContext, useContext } from 'react'
import MessagesSidebar from '@/components/MessagesSidebar'

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

// Контекст для управления мобильным видом
const MobileChatContext = createContext<{
  isMobileChatOpen: boolean
  setIsMobileChatOpen: (open: boolean) => void
}>({
  isMobileChatOpen: false,
  setIsMobileChatOpen: () => {},
})

export const useMobileChat = () => useContext(MobileChatContext)

interface MessagesLayoutShellProps {
  children: React.ReactNode
  coaches: Coach[]
}

export default function MessagesLayoutShell({ children, coaches }: MessagesLayoutShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)

  return (
    <MobileChatContext.Provider value={{ isMobileChatOpen, setIsMobileChatOpen }}>
      <div className="flex flex-1 overflow-hidden relative min-h-0 bg-gray-50">
        
        {/* ЛЕВАЯ ПАНЕЛЬ (Сайдбар) */}
        {/* На мобильном: занимает 100% ширины, скрывается если isMobileChatOpen */}
        {/* На десктопе: фиксированная ширина, анимация сворачивания */}
        <div
          className={`
            bg-white flex-shrink-0 transition-all duration-300 ease-in-out border-r border-purple-100 flex flex-col
            ${isMobileChatOpen ? 'hidden md:flex' : 'flex w-full md:w-80'}
            ${!isMobileChatOpen && !isSidebarOpen ? 'md:w-0 md:border-r-0' : ''}
          `}
        >
          <div className="w-full md:w-80 flex-1 flex flex-col min-h-0 bg-white">
            <MessagesSidebar coaches={coaches} />
          </div>
        </div>

        {/* Кнопка сворачивания (ТОЛЬКО ДЕСКТОП) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-white border border-purple-200 shadow-sm items-center justify-center hover:bg-purple-50 transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'left-80' : 'left-0'
          }`}
          style={{ borderRadius: '0 8px 8px 0' }}
          title={isSidebarOpen ? 'Свернуть панель' : 'Развернуть панель'}
        >
          <svg
            className={`w-4 h-4 text-purple-600 transition-transform duration-300 ${
              isSidebarOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* ПРАВАЯ ПАНЕЛЬ (Чат) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white md:rounded-r-2xl md:shadow-sm md:border md:border-l-0 md:border-purple-100">
          
          {/* Мобильная шапка с кнопкой "Назад" (показывается только на мобильном, когда чат открыт) */}
          <div className="md:hidden flex items-center gap-3 p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50">
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

          {/* Контент чата */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {children}
          </div>
        </div>

      </div>
    </MobileChatContext.Provider>
  )
}