'use client'

import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Ошибка при выходе:', error)
      alert('Не удалось выйти из системы')
    }
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
    >
      🚪 Выйти
    </button>
  )
}