'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  actionLabel?: string
  onAction?: () => void
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  showActionToast: (message: string, actionLabel: string, onAction: () => void, durationMs?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  // Тост с кнопкой действия (например «Вернуть» после удаления) — не исчезает
  // при наведении, чтобы можно было спокойно нажать
  const showActionToast = (message: string, actionLabel: string, onAction: () => void, durationMs = 5000) => {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, message, type: 'info', actionLabel, onAction }])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, durationMs)
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast, showActionToast }}>
      {children}
      <div className="fixed top-20 right-4 z-[10000] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border max-w-md pointer-events-auto animate-in slide-in-from-right fade-in duration-200 ${
              toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : toast.type === 'error' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-sm font-medium">{toast.message}</div>
              {toast.actionLabel && (
                <button
                  onClick={() => { toast.onAction?.(); removeToast(toast.id) }}
                  className="flex-shrink-0 text-sm font-bold underline underline-offset-2 hover:opacity-80"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}