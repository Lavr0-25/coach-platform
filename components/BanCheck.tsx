'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function BanCheck() {
  const [isBanned, setIsBanned] = useState(false)
  const [banInfo, setBanInfo] = useState<{ until: string; reason: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkBan()
  }, [])

  const checkBan = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('stop_list')
        .select('*')
        .eq('user_id', user.id)
        .gte('banned_until', new Date().toISOString())
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking ban:', error)
        return
      }

      if (data) {
        setIsBanned(true)
        setBanInfo({
          until: data.banned_until,
          reason: data.reason,
        })
      }
    } catch (error) {
      console.error('Error checking ban:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!isBanned || !banInfo) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-red-200">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Аккаунт заблокирован
          </h2>
          <p className="text-gray-600">
            Вы заблокированы администрацией сайта
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
                Дата разблокировки
              </p>
              <p className="text-lg font-bold text-red-900">
                {new Date(banInfo.until).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
                Причина
              </p>
              <p className="text-sm text-red-800">
                {banInfo.reason}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full gradient-btn text-white py-3 rounded-xl font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl transition-all"
          >
            Выйти из аккаунта
          </button>
          <p className="text-xs text-gray-500 text-center">
            Если вы считаете блокировку ошибочной, обратитесь в поддержку
          </p>
        </div>
      </div>
    </div>
  )
}