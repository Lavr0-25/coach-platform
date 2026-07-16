'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import NotificationsBell from './NotificationsBell'
import MessagesBell from './MessagesBell'
import FeedbackModal from './FeedbackModal'

interface Profile {
  display_name?: string
  email?: string
  role?: string
}

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMentor, setIsMentor] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      if (!mounted) return
      setIsLoaded(false)

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (!mounted) return

        if (userError) {
          console.error('Auth error:', userError)
          setUser(null)
          setProfile(null)
          setIsMentor(false)
          setIsAdmin(false)
          setIsLoaded(true)
          return
        }
        
        setUser(user)

        if (user) {
          try {
            const { data: coachData, error: coachError } = await supabase
              .from('coaches')
              .select('display_name, role')
              .eq('user_id', user.id)
              .single()

            if (!mounted) return

            if (coachError && coachError.code !== 'PGRST116') {
              console.error('Coach query error:', coachError)
            }

            if (coachData) {
              setProfile(coachData)
              setIsMentor(coachData.role === 'mentor' || coachData.role === 'admin')
              setIsAdmin(coachData.role === 'admin')
            } else {
              setProfile({ display_name: user.email?.split('@')[0] || 'Пользователь' })
              setIsMentor(false)
              setIsAdmin(false)
            }
          } catch (err) {
            if (!mounted) return
            console.error('Coach load error:', err)
            setProfile({ display_name: user.email?.split('@')[0] || 'Пользователь' })
            setIsMentor(false)
            setIsAdmin(false)
          }
        } else {
          setProfile(null)
          setIsMentor(false)
          setIsAdmin(false)
        }

        if (mounted) setIsLoaded(true)
      } catch (error) {
        if (!mounted) return
        console.error('Navbar load error:', error)
        setUser(null)
        setProfile(null)
        setIsMentor(false)
        setIsAdmin(false)
        setIsLoaded(true)
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUser()
      } else {
        setProfile(null)
        setIsMentor(false)
        setIsAdmin(false)
        setIsLoaded(true)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleBecomeMentor = async () => {
    if (!user) return
    
    try {
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
      setProfile(prev => ({ ...prev, role: 'mentor' }))
      alert('🎉 Теперь вы автор! Теперь вы можете создавать уроки.')
      router.refresh()
    } catch (error: any) {
      console.error('Error becoming mentor:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось стать автором'))
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setIsMentor(false)
      setIsAdmin(false)
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
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-purple-200/50 fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Логотип с градиентом */}
          <Link href="/" className="text-2xl font-bold gradient-text hover:opacity-80 transition-opacity">
            CoachPlatform
          </Link>

          {/* Навигация */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/mentors" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">
              👥 Авторы
            </Link>
            
            {user && isMentor && (
              <Link href="/favorites" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">
                 Избранное
              </Link>
            )}
          </div>

          {/* Правая часть */}
          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="w-10 h-10 bg-purple-100 rounded-full animate-pulse" />
            ) : user ? (
              <>
                <MessagesBell />
                <NotificationsBell />

                {!isMentor && (
                  <button
                    onClick={handleBecomeMentor}
                    className="hidden md:inline-flex gradient-btn px-4 py-2 text-white rounded-full font-medium text-sm shadow-lg shadow-purple-500/30"
                  >
                     Стать автором
                  </button>
                )}

                {isMentor ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-purple-50 transition-colors"
                    >
                      <div className="w-9 h-9 gradient-icon rounded-full flex items-center justify-center text-white font-semibold text-sm">
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
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-purple-100 z-20 overflow-hidden">
                          <div className="p-4 border-b border-purple-100 bg-gradient-to-br from-purple-50 to-blue-50">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 gradient-icon rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                                {getInitials(profile?.display_name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                  {profile?.display_name || 'Пользователь'}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {user.email}
                                </p>
                                {isAdmin && (
                                  <span className="inline-block mt-1 text-xs bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-0.5 rounded-full font-medium">
                                     Администратор
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="py-2">
                            {isAdmin && (
                              <Link
                                href="/admin"
                                className="flex items-center gap-3 px-4 py-2.5 text-purple-600 hover:bg-purple-50 transition-colors border-b border-purple-100"
                                onClick={() => setShowProfileMenu(false)}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="font-semibold">Админ-панель</span>
                              </Link>
                            )}

                            <Link
                              href="/dashboard/mentor"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Личный кабинет
                            </Link>

                            <Link
                              href="/dashboard/mentor/profile"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Настройки профиля
                            </Link>

                            <Link
                              href="/dashboard/mentor/courses"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              Мои курсы
                            </Link>

                            <Link
                              href="/dashboard/mentor/lessons"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Мои уроки
                            </Link>

                            <Link
                              href="/favorites"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              Избранное
                            </Link>

                            <button
                              onClick={() => {
                                setShowProfileMenu(false)
                                setShowFeedbackModal(true)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
                            >
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              Обратная связь
                            </button>

                            <hr className="my-2 border-purple-100" />

                            <button
                              onClick={handleSignOut}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
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
                  <Link
                    href="/dashboard/mentor"
                    className="px-4 py-2 text-gray-700 hover:text-purple-600 font-medium transition-colors"
                  >
                    Кабинет
                  </Link>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-gray-700 hover:text-purple-600 font-medium transition-colors"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="gradient-btn px-4 py-2 text-white rounded-full font-medium text-sm shadow-lg shadow-purple-500/30"
                >
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {user && (
        <FeedbackModal 
          isOpen={showFeedbackModal} 
          onClose={() => setShowFeedbackModal(false)} 
        />
      )}
    </nav>
  )
}