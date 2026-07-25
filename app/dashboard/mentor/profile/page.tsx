'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CoverImageUploader from '@/components/CoverImageUploader'

export default function MentorProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'profile' | 'dashboard'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Данные профиля
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [coachId, setCoachId] = useState<string>('')
  const [coachUserId, setCoachUserId] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isOwner, setIsOwner] = useState(false)
  
  // Данные для смены пароля
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Статистика
  const [stats, setStats] = useState({
    totalLessons: 0,
    totalCourses: 0,
    inCoursesLessons: 0,
    freeLessons: 0,
  })
  
  // Контент
  const [myLessons, setMyLessons] = useState<any[]>([])
  const [myCourses, setMyCourses] = useState<any[]>([])

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setCurrentUserId(user.id)

      const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id, user_id, display_name, bio, specialization, avatar_url')
        .eq('user_id', user.id)
        .single()

      if (coachError) {
        console.error('❌ Coach error:', coachError)
        setError('Ошибка загрузки профиля: ' + coachError.message)
        return
      }

      if (coach) {
        setCoachId(coach.id)
        setCoachUserId(coach.user_id)
        setDisplayName(coach.display_name || '')
        setBio(coach.bio || '')
        setSpecialization(coach.specialization || '')
        setAvatarUrl(coach.avatar_url || '')
        setIsOwner(user.id === coach.user_id)

        await loadContent(coach.id)
      }
    } catch (error: any) {
      console.error(' Error loading profile:', error)
      setError(error.message || 'Ошибка загрузки профиля')
    } finally {
      setLoading(false)
    }
  }

  const loadContent = async (coachId: string) => {
    try {
      // === 1. Загружаем ВСЕ уроки ===
      const { data: allLessons } = await supabase
        .from('lessons')
        .select('id, title, description, price, is_free_preview, course_id, cover_image, created_at')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
      
      if (allLessons) {
        const totalLessons = allLessons.length
        const inCoursesLessons = allLessons.filter(l => l.course_id).length
        const freeLessons = allLessons.filter(l => l.is_free_preview).length
        
        setStats(prev => ({
          ...prev,
          totalLessons,
          inCoursesLessons,
          freeLessons,
        }))
        
        setMyLessons(allLessons.slice(0, 10))
      }

      // === 2. Загружаем ВСЕ курсы ===
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, title, description, price, is_published, cover_image, created_at')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
      
      if (allCourses) {
        setStats(prev => ({
          ...prev,
          totalCourses: allCourses.length,
        }))
        
        setMyCourses(allCourses.slice(0, 10))
      }
    } catch (error: any) {
      console.error('❌ Error loading content:', error)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!displayName.trim()) {
      setError('Введите имя для отображения')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          specialization: specialization.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq('id', coachId)

      if (error) throw error

      setSuccess('Профиль успешно обновлён!')
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { displayName } 
      }))
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError(error.message || 'Ошибка при сохранении профиля')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('Новый пароль должен содержать минимум 8 символов')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setSuccess('Пароль успешно изменён!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setError(error.message || 'Ошибка при смене пароля')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:text-purple-600 transition-colors">Главная</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Личный кабинет</span>
      </div>

      {/* Уведомления */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {success}
        </div>
      )}

      {/* Вкладки (Профиль первый, Дашборд второй, без Настроек) */}
      <div className="flex border-b border-purple-100 mb-8 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 sm:px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'profile'
              ? 'text-purple-700 border-b-2 border-purple-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
           Профиль
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 sm:px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'dashboard'
              ? 'text-purple-700 border-b-2 border-purple-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 Дашборд
        </button>
      </div>

      {/* Вкладка: Профиль (теперь 1-я) */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Информация о профиле с кнопкой Настройки */}
          <div className="style-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-purple-600">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{displayName || 'Ваш профиль'}</h1>
                  
                  {/* Кнопка Настройки видна только владельцу */}
                  {isOwner && (
                    <button
                      onClick={() => setActiveTab('settings' as any)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Настройки
                    </button>
                  )}
                </div>
                
                {specialization && (
                  <p className="text-lg text-gray-600 mb-3">{specialization}</p>
                )}
                
                <div className="flex flex-wrap gap-6 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold gradient-text">{stats.totalLessons}</div>
                    <div className="text-sm text-gray-600">уроков</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold gradient-text">{stats.totalCourses}</div>
                    <div className="text-sm text-gray-600">курсов</div>
                  </div>
                </div>

                {bio && (
                  <div className="pt-4 border-t border-purple-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Обо мне</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{bio}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Мои курсы */}
          {myCourses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📚</span>
                  Мои курсы
                </h2>
                <Link href="/dashboard/mentor/courses" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                  Все курсы →
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/dashboard/mentor/courses/${course.id}/edit`}
                    className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
                  >
                    <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                      {course.cover_image ? (
                        <img src={course.cover_image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="opacity-50">📚</span>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {course.title}
                    </h3>
                    
                    {course.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {course.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-purple-700">
                          {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Отдельные уроки */}
          {myLessons.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📝</span>
                  Мои уроки
                </h2>
                <Link href="/dashboard/mentor/lessons" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                  Все уроки →
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myLessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                    className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
                  >
                    <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                      <span className="opacity-50">📝</span>
                    </div>
                    
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {lesson.title}
                    </h3>
                    
                    {lesson.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {lesson.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                      <div className="flex items-center gap-2">
                        {lesson.is_free_preview ? (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                            Бесплатно
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-purple-700">
                            {lesson.price} ₽
                          </span>
                        )}
                      </div>
                      
                      <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Редактировать
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Если нет материалов */}
          {myLessons.length === 0 && myCourses.length === 0 && (
            <div className="style-card p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Пока нет материалов</h2>
              <p className="text-gray-600 mb-6">
                Создайте свой первый урок или курс, чтобы начать делиться знаниями
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/dashboard/mentor/lessons/new"
                  className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Создать урок
                </Link>
                <Link
                  href="/dashboard/mentor/courses"
                  className="bg-white text-purple-700 border border-purple-200 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Мои курсы
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Вкладка: Дашборд (теперь 2-я) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Приветствие */}
          <div className="style-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold text-purple-600">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">
                  Добро пожаловать{displayName ? `, ${displayName}` : ''}! 
                </h1>
                <p className="text-gray-600 mb-4">
                  Управляйте своими уроками, следите за прогрессом и развивайте свою школу
                </p>
                
                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  <Link
                    href="/dashboard/mentor/lessons/new"
                    className="gradient-btn text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Создать урок
                  </Link>
                  
                  <Link
                    href="/dashboard/mentor/courses"
                    className="bg-white text-purple-700 border border-purple-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-50 transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Мои курсы
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="style-card p-4 text-center">
              <div className="text-3xl font-bold gradient-text mb-1">{stats.totalLessons}</div>
              <div className="text-sm text-gray-600">Всего уроков</div>
            </div>
            <div className="style-card p-4 text-center">
              <div className="text-3xl font-bold gradient-text mb-1">{stats.totalCourses}</div>
              <div className="text-sm text-gray-600">Курсов</div>
            </div>
            <div className="style-card p-4 text-center">
              <div className="text-3xl font-bold gradient-text mb-1">{stats.inCoursesLessons}</div>
              <div className="text-sm text-gray-600">В курсах</div>
            </div>
            <div className="style-card p-4 text-center">
              <div className="text-3xl font-bold gradient-text mb-1">{stats.freeLessons}</div>
              <div className="text-sm text-gray-600">Бесплатных</div>
            </div>
          </div>

          {/* Быстрые действия */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/mentor/courses" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl mb-3 group-hover:scale-110 transition-transform">
                📚
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Мои курсы</h3>
              <p className="text-sm text-gray-600">Управление курсами</p>
            </Link>

            <Link href="/dashboard/mentor/lessons" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl mb-3 group-hover:scale-110 transition-transform">
                📝
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Мои уроки</h3>
              <p className="text-sm text-gray-600">Управление уроками</p>
            </Link>

            <Link href="/mentor/analytics" className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
              <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl mb-3 group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Статистика</h3>
              <p className="text-sm text-gray-600">Аналитика и просмотры</p>
            </Link>

            {isOwner && (
              <button
                onClick={() => setActiveTab('settings' as any)}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100 text-left w-full"
              >
                <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl mb-3 group-hover:scale-110 transition-transform">
                  ⚙️
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Настройки</h3>
                <p className="text-sm text-gray-600">Профиль и пароль</p>
              </button>
            )}
          </div>

          {/* Последние уроки */}
          {myLessons.length > 0 && (
            <div className="style-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Последние уроки</h2>
                <Link href="/dashboard/mentor/lessons" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                  Все уроки →
                </Link>
              </div>
              
              <div className="space-y-3">
                {myLessons.slice(0, 5).map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                    className="flex items-center gap-4 p-4 bg-purple-50/30 rounded-xl border border-purple-100 hover:bg-purple-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                        {lesson.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {lesson.price === 0 ? 'Бесплатно' : `${lesson.price} ₽`}
                        {lesson.is_free_preview && ' • Превью'}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Вкладка: Настройки (скрытая, доступна только через кнопку) */}
      {(activeTab as any) === 'settings' && isOwner && (
        <div className="space-y-6">
          {/* Кнопка назад к профилю */}
          <button
            onClick={() => setActiveTab('profile')}
            className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад к профилю
          </button>

          {/* Основная информация */}
          <form onSubmit={handleSaveProfile} className="style-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              Основная информация
            </h2>
            
            <div className="space-y-5">
              <div>
                <label htmlFor="displayName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Имя для отображения *
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Иван Иванов"
                />
              </div>

              <div>
                <label htmlFor="specialization" className="block text-sm font-semibold text-gray-700 mb-2">
                  Специализация
                </label>
                <input
                  id="specialization"
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Психолог, бизнес-коуч, преподаватель"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-semibold text-gray-700 mb-2">
                  О себе
                </label>
                <textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                  placeholder="Расскажите о себе, своём опыте и подходе..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Аватар
                </label>
                <CoverImageUploader
                  currentImage={avatarUrl}
                  onImageUpload={(url) => setAvatarUrl(url)}
                  entityType="course"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Рекомендуемый размер: 400×400px (1:1)
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-purple-100">
              <button
                type="submit"
                disabled={saving}
                className="gradient-btn text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>

          {/* Смена пароля */}
          <form onSubmit={handleChangePassword} className="style-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              Смена пароля
            </h2>
            
            <div className="space-y-5">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Новый пароль *
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Минимум 8 символов"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Подтвердите пароль *
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Повторите пароль"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-purple-100">
              <button
                type="submit"
                disabled={saving}
                className="bg-gray-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Изменение...' : 'Изменить пароль'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}