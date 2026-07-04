'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

interface Profile {
  display_name?: string
  email?: string
}

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMentor, setIsMentor] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const loadingRef = useRef(false)

  const loadUser = async () => {
    loadingRef.current = true
    setIsLoaded(false)

    try {
      await supabase.auth.refreshSession()
      
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('coaches')
          .select('display_name, role')
          .eq('user_id', user.id)
          .single()

        setProfile(data)
        setIsMentor(data?.role === 'mentor' || data?.role === 'admin')
      } else {
        setProfile(null)
        setIsMentor(false)
      }

      setIsLoaded(true)
    } catch (error) {
      console.error('Navbar load error:', error)
      setIsLoaded(true)
    } finally {
      loadingRef.current = false
    }
  }

  useEffect(() => {
    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoaded(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [pathname])

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('auth-token')) {
        loadUser()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleBecomeMentor = async () => {
    if (!user) return
    
    try {
      // Убрали email — его нет в таблице coaches
      const { error } = await supabase
        .from('coaches')
        .upsert({
          user_id: user.id,
          display_name: profile?.display_name || user.email?.split('@')[0] || 'Наставник',
          role: 'mentor',
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
      
      setIsMentor(true)
      alert('🎉 Теперь вы наставник! Теперь вы можете создавать уроки.')
      router.refresh()
    } catch (error: any) {
      console.error('Error becoming mentor:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось стать наставником'))
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setIsMentor(false)
      setIsLoaded(true)
      router.push('/')
      router.refresh()
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
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
            CoachPlatform
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/catalog" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              📚 Каталог уроков
            </Link>
            <Link href="/mentors" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              👨‍🏫 Наставники
            </Link>
            
            {user && isMentor && (
              <>
                <Link href="/favorites" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                  ⭐ Избранное
                </Link>
                <Link href="/purchases" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                  🎓 Мои курсы
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!isLoaded ? (
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            ) : user ? (
              <>
                {/* Кнопка "Стать наставником" (если ещё не наставник) */}
                {!isMentor && (
                  <button
                    onClick={handleBecomeMentor}
                    className="hidden md:inline-flex px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
                  >
                     Стать наставником
                  </button>
                )}

                {/* Меню профиля (только для наставников) */}
                {isMentor && (
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {getInitials(profile?.display_name)}
                      </div>
                      <span className="hidden md:block text-gray-700 font-medium max-w-[150px] truncate">
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

                    {showProfileMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border z-20">
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

                            <Link
                              href="/favorites"
                              className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <span className="text-xl">⭐</span>
                              Избранное
                            </Link>

                            <Link
                              href="/purchases"
                              className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <span className="text-xl">🎓</span>
                              Мои курсы
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
                )}

                {/* Кнопка "Войти" для авторизованных НЕ-наставников */}
                {!isMentor && (
                  <Link
                    href="/dashboard/mentor"
                    className="px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors"
                  >
                    Кабинет
                  </Link>
                )}
              </>
            ) : (
              // НЕ авторизован — показываем Войти и Регистрацию
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