'use client'

import { useState } from 'react'
import MessagesSidebar from '@/components/MessagesSidebar'

interface Coach {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  specialization: string | null
}

export default function MessagesLayoutShell({
  children,
  coaches,
}: {
  children: React.ReactNode
  coaches: Coach[]
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="flex flex-1 overflow-hidden relative min-h-0 bg-white">
      {/* Кнопка сворачивания/разворачивания */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'left-80' : 'left-0'
        }`}
        style={{ borderRadius: '0 8px 8px 0' }}
        title={isSidebarOpen ? 'Свернуть панель' : 'Развернуть панель'}
      >
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${
            isSidebarOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Левая панель (Сайдбар) */}
      <div
        className={`bg-white flex-shrink-0 transition-all duration-300 ease-in-out border-r overflow-hidden flex flex-col ${
          isSidebarOpen ? 'w-80' : 'w-0'
        }`}
      >
        <div className="w-80 flex-1 flex flex-col min-h-0 bg-white">
          <MessagesSidebar coaches={coaches} />
        </div>
      </div>

      {/* Правая часть - сам чат */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {children}
      </div>
    </div>
  )
}