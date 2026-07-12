'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MessageModalProps {
  coachId: string
  coachName: string
  isOpen: boolean
  onClose: () => void
}

export default function MessageModal({ coachId, coachName, isOpen, onClose }: MessageModalProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const supabase = createClient()

  const handleSend = async () => {
    if (!message.trim()) return

    setIsSending(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert('Пожалуйста, войдите в систему')
      setIsSending(false)
      return
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: coachId,
        content: message,
        is_read: false
      })

    if (error) {
      console.error('Message error:', error)
      alert('Ошибка при отправке сообщения: ' + error.message)
    } else {
      setIsSent(true)
      setTimeout(() => {
        onClose()
        setIsSent(false)
        setMessage('')
      }, 2000)
    }
    
    setIsSending(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Написать сообщение {coachName}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        
        {isSent ? (
          <div className="text-center py-8">
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <p className="text-lg text-gray-700">Сообщение отправлено!</p>
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Введите ваше сообщение..."
              className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isSending}
              >
                Отмена
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !message.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}