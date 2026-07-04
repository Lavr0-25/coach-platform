'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Profile {
  display_name?: string
  email?: string
}

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const loadingRef = useRef(false)

  useEffect(() => {
    // Если уже загружено или идёт загрузка — выходим
    if (isLoaded || loadingRef.current) return

    const loadUser = async () => {
      loadingRef.current = true

      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          const { data } = await supabase
            .from('coaches')
            .select('display_name')
            .eq('user_id', user.id)
            .single()

          setProfile(data)
        }

        setIsLoaded(true)
      } catch (error) {
        console.error('Navbar load error:', error)
      } finally {
        loadingRef.current = false
      }
    }

    loadUser()

    // Слушаем событие обновления профиля
    const handleProfileUpdate = (event: CustomEvent) => {
      setProfile((prev: Profile | null) => ({
        ...prev,
        display_name: event.detail.displayName
      }))
    }

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener)

    // Очистка
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
    }
  }, [isLoaded])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Ошибка при выходе:', error)
      alert('Не удалось выйти из системы')
    }
  }

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Логотип */}
          <Link href="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
            CoachPlatform
          </Link>

          {/* Навигация */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/catalog" className="text-gray-700 hover:text-blue-600 transition-colors">
              Каталог уроков
            </Link>
            <Link href="/mentors" className="text-gray-700 hover:text-blue-600 transition-colors">
              Наставники
            </Link>
          </div>

          {/* Правая часть */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                {/* Иконка профиля */}
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {getInitials(profile?.display_name)}
                  </div>
                  <span className="hidden md:block text-gray-700 font-medium">
                    {profile?.display_name || 'Пользователь'}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Выпадающее меню */}
                {showProfileMenu && (
                  <>
                    {/* Затемнение фона */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProfileMenu(false)}
                    />

                    {/* Меню */}
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border z-20">
                      {/* Информация о пользователе */}
                      <div className="p-4 border-b">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {getInitials(profile?.display_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {profile?.display_name || 'Пользователь'}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Пункты меню */}
                      <div className="py-2">
                        <Link
                          href="/dashboard/mentor"
                          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Личный кабинет
                        </Link>

                        <Link
                          href="/dashboard/mentor/profile"
                          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Настройки профиля
                        </Link>

                        <hr className="my-2" />

                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Выйти
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}