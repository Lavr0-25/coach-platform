'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function MessagesBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  const loadUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    setUnreadCount(count || 0)
  }

  useEffect(() => {
    loadUnreadCount()

    // Подписка на новые сообщения
    const subscription = supabase
      .channel('messages-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadUnreadCount()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadUnreadCount()
        }
      )
      .subscribe()

    // Слушаем событие прочтения сообщений из sidebar
    const handleMessagesRead = () => {
      loadUnreadCount()
    }

    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      supabase.removeChannel(subscription)
      window.removeEventListener('messages-read', handleMessagesRead)
    }
  }, [])

  return (
    <Link
      href="/messages"
      className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      title="Сообщения"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}