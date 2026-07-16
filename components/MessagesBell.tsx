'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function MessagesBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  const loadUnreadCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUnreadCount(0)
      return
    }

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Ошибка при подсчете непрочитанных:', error)
    } else {
      setUnreadCount(count || 0)
    }
  }, [supabase])

  useEffect(() => {
    loadUnreadCount()

    const channel = supabase
      .channel('messages-bell-unread')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadUnreadCount()
        }
      )
      .subscribe()

    const handleMessagesRead = () => {
      loadUnreadCount()
    }

    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('messages-read', handleMessagesRead)
    }
  }, [loadUnreadCount])

  return (
    <Link
      href="/messages"
      className="relative p-2 rounded-xl hover:bg-purple-50 transition-all group"
      title="Сообщения"
    >
      <div className="w-6 h-6 gradient-icon rounded-lg p-1 flex items-center justify-center group-hover:scale-110 transition-transform">
        <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}