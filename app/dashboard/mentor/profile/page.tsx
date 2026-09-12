'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import FileUploader from '@/components/FileUploader'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { BadgeCheck, BookOpen, Check, Clock, Lock, PenLine, SearchX, XCircle } from 'lucide-react'
import { Input, Textarea } from '@/components/ui/Input'
import { validatePassword } from '@/lib/password'

export default function MentorProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  
  // Данные профиля
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  // Ф3: цена платной подписки ₽/мес (пустая строка = не настроена) и
  // read-only статус рубильника paid_publishing_allowed (меняет только админ)
  const [subscriptionPrice, setSubscriptionPrice] = useState('')
  const [paidPublishingAllowed, setPaidPublishingAllowed] = useState(false)
  // Цена, реально лежащая в БД (обновляется после успешного сохранения) —
  // по ней показываем «Текущая цена», чтобы сохранение было видимым
  const [savedPrice, setSavedPrice] = useState<string>('')
  const [priceSaved, setPriceSaved] = useState(false)
  // У каждой формы свой флаг сохранения — общий заставлял бы все кнопки
  // показывать «загрузку» одновременно
  const [priceSaving, setPriceSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  // Последняя заявка на верификацию (feedback type='verification') — по ней
  // показываем статус блока: на проверке / отклонена (с ответом админа)
  const [verification, setVerification] = useState<any>(null)
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
    subscribers: 0, // 🔥 Добавили подписчиков
  })
  
  // Контент
  const [myLessons, setMyLessons] = useState<any[]>([])
  const [myCourses, setMyCourses] = useState<any[]>([])

  useEffect(() => {
    loadProfile()
  }, [])

  // Debounce для поиска (300ms, после 3 символов)
  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setDebouncedSearch('')
    }
  }, [searchQuery])

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
        .select('id, user_id, display_name, bio, specialization, avatar_url, is_verified, subscription_price, paid_publishing_allowed, profiles(is_public)')
        .eq('user_id', user.id)
        .maybeSingle()

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
        setIsPublic((coach as any).profiles?.is_public ?? true)
        setIsVerified(!!coach.is_verified)
        setIsOwner(user.id === coach.user_id)
        setSubscriptionPrice(
          coach.subscription_price != null ? String(coach.subscription_price) : ''
        )
        setSavedPrice(
          coach.subscription_price != null ? String(coach.subscription_price) : ''
        )
        setPaidPublishingAllowed(!!(coach as any).paid_publishing_allowed)

        // Последняя заявка на верификацию — её статус показываем в блоке «Верификация»
        const { data: verifs } = await supabase
          .from('feedback')
          .select('id, status, admin_reply, replied_at, created_at')
          .eq('user_id', user.id)
          .eq('type', 'verification')
          .order('created_at', { ascending: false })
          .limit(1)
        setVerification(verifs?.[0] || null)

        // 🔥 Передаём и coach.id, и coach.user_id
        await loadContent(coach.id, coach.user_id)
      }
    } catch (error: any) {
      console.error('❌ Error loading profile:', error)
      setError(error.message || 'Ошибка загрузки профиля')
    } finally {
      setLoading(false)
    }
  }

  const loadContent = async (coachId: string, coachUserId: string) => {
    try {
      console.log('🔍 loadContent вызвана:', { coachId, coachUserId })

      // === 1. Загружаем ВСЕ уроки ===
      const { data: allLessons } = await supabase
        .from('lessons')
        .select('id, title, description, price, is_free_preview, cover_image, created_at')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })

      // Уроки в курсах — через связку course_lessons (урок может быть в нескольких)
      const { data: linkedRows } = await supabase
        .from('course_lessons')
        .select('lesson_id')
      const linkedIds = new Set((linkedRows || []).map((r: any) => r.lesson_id))

      if (allLessons) {
        const totalLessons = allLessons.length
        const inCoursesLessons = allLessons.filter(l => linkedIds.has(l.id)).length
        const freeLessons = allLessons.filter(l => l.is_free_preview).length
        
        setStats(prev => ({
          ...prev,
          totalLessons,
          inCoursesLessons,
          freeLessons,
        }))
        
        setMyLessons(allLessons)
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
        
        setMyCourses(allCourses)
      }

      // === 3. 🔥 Загружаем количество подписчиков с отладкой ===
      console.log('📊 Запрос подписок для coach_id (должен быть равен user_id):', coachUserId)
      
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('user_id, coach_id')
        .eq('coach_id', coachUserId)

      if (subsError) {
        console.error('❌ Ошибка при загрузке подписок:', subsError)
      }

      console.log('📥 Получено записей подписок:', subsData?.length)
      console.log('📋 Массив данных подписок:', subsData)

      const uniqueSubscribers = new Set(subsData?.map((s: any) => s.user_id) || [])
      
      console.log('✅ Уникальных подписчиков (размер Set):', uniqueSubscribers.size)
      
      setStats(prev => ({
        ...prev,
        subscribers: uniqueSubscribers.size,
      }))

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

      // Приватность профиля — отдельный запрос (вложенные update PostgREST не поддерживает)
      const { error: privacyError } = await supabase
        .from('profiles')
        .update({ is_public: isPublic })
        .eq('id', currentUserId)

      if (privacyError) throw privacyError

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

  // Ф3: цена подписки — отдельная форма (не мешает сохранению профиля).
  // Пусто = подписка не настроена; иначе вилка 99–9990 ₽ (DB CHECK страхует,
  // но ошибку лучше показать сразу, до сохранения).
  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    let priceValue: number | null = null
    if (subscriptionPrice.trim() !== '') {
      priceValue = Number(subscriptionPrice)
      if (!Number.isFinite(priceValue) || priceValue < 99 || priceValue > 9990) {
        setError('Цена подписки должна быть от 99 до 9990 ₽ в месяц')
        return
      }
    }

    if (!paidPublishingAllowed) {
      setError('Продажи пока не включены — см. пояснение в блоке «Продажа платного контента»')
      return
    }

    setPriceSaving(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .update({ subscription_price: priceValue })
        .eq('id', coachId)

      if (error) throw error

      setSavedPrice(subscriptionPrice.trim())
      setPriceSaved(true)
      setTimeout(() => setPriceSaved(false), 4000)
    } catch (error: any) {
      setError(error.message || 'Ошибка при сохранении цены')
    } finally {
      setPriceSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const pwCheck = validatePassword(newPassword)
    if (!pwCheck.ok) {
      setError(pwCheck.message!)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setPasswordSaving(true)

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
      setPasswordSaving(false)
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  // 🔥 Функция для склонения слова "подписчик"
  const getSubscribersWord = (count: number) => {
    if (count === 1) return 'подписчик'
    if (count < 5) return 'подписчика'
    return 'подписчиков'
  }

  // Фильтрация по поиску
  const filteredCourses = debouncedSearch
    ? myCourses.filter(c => 
        c.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (c.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) || false)
      )
    : myCourses

  const filteredLessons = debouncedSearch
    ? myLessons.filter(l => 
        l.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (l.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) || false)
      )
    : myLessons

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
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />

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

      {/* Вкладка: Профиль */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Информация о профиле с кнопкой Настройки */}
          <Card variant="glow" padding="none" className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" width={128} height={128} className="w-full h-full object-cover" />
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
                      onClick={() => setActiveTab('settings')}
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
                
                {/* 🔥 Обновлённая статистика с подписчиками */}
                <div className="flex flex-wrap gap-6 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold gradient-text">{stats.totalLessons}</div>
                    <div className="text-sm text-gray-600">уроков</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold gradient-text">{stats.totalCourses}</div>
                    <div className="text-sm text-gray-600">курсов</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold gradient-text">{stats.subscribers}</div>
                    <div className="text-sm text-gray-600">
                      {getSubscribersWord(stats.subscribers)}
                    </div>
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
          </Card>

          {/* Верификация автора: статус + заявка */}
          <Card variant="glow" padding="none" className="p-6">
            {isVerified ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                  <BadgeCheck className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    Проверенный автор
                    <Badge variant="greenFill">Верифицирован</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Профиль подтверждён администрацией. Значок виден на вашей публичной странице и в каталоге авторов.
                  </p>
                </div>
              </div>
            ) : verification && (verification.status === 'new' || verification.status === 'in_progress') ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Заявка на верификацию отправлена</div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Админ проверит заявку и ответит в разделе «Обратная связь» — там же можно дополнить её, пока она «Новое».
                  </p>
                </div>
              </div>
            ) : verification && verification.status === 'rejected' ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Заявка на верификацию отклонена</div>
                  {verification.admin_reply && (
                    <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line break-words">
                      Причина: {verification.admin_reply}
                    </p>
                  )}
                  <Link
                    href="/feedback?type=verification"
                    className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium"
                  >
                    <BadgeCheck className="w-4 h-4" strokeWidth={1.5} />
                    Подать заявку снова
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Верификация автора</div>
                  <p className="text-sm text-gray-600">
                    Подтверждённые авторы получают значок «Проверенный автор» на публичной странице и в каталоге —
                    студенты видят, что администрация платформы проверила автора.
                  </p>
                </div>
                <Link
                  href="/feedback?type=verification"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium flex-shrink-0"
                >
                  <BadgeCheck className="w-4 h-4" strokeWidth={1.5} />
                  Подать заявку
                </Link>
              </div>
            )}
          </Card>

          {/* Поиск по контенту */}
          <div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по моим курсам и урокам..."
                className="w-full px-5 py-3 pl-12 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-[box-shadow,border-color,background-color,color]"
              />
              <svg 
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {debouncedSearch && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Найдено: <span className="font-bold text-purple-700">{filteredCourses.length + filteredLessons.length}</span> материалов
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Сбросить поиск
                </button>
              </div>
            )}
          </div>

          {/* Мои курсы */}
          {filteredCourses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">
                    <BookOpen className="w-5 h-5" strokeWidth={1.5} />
                  </span>
                  Мои курсы {debouncedSearch && <span className="text-base text-gray-500">({filteredCourses.length})</span>}
                </h2>
                <Link href="/dashboard/mentor/courses" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                  Все курсы →
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/dashboard/mentor/courses/${course.id}/edit`}
                    className="style-card p-5 hover:shadow-lg transition-colors group border border-purple-100"
                  >
                    <div className="relative aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                      {course.cover_image ? (
                        <Image src={course.cover_image} alt={course.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="w-full h-full object-cover transition-transform duration-300" />
                      ) : (
                        <BookOpen className="w-12 h-12 opacity-50" strokeWidth={1.5} />
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
          {filteredLessons.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">
                    <PenLine className="w-5 h-5" strokeWidth={1.5} />
                  </span>
                  Мои материалы {debouncedSearch && <span className="text-base text-gray-500">({filteredLessons.length})</span>}
                </h2>
                <Link href="/dashboard/mentor/lessons" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                  Все уроки →
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                    className="style-card p-5 hover:shadow-lg transition-colors group border border-purple-100"
                  >
                    <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                      <PenLine className="w-12 h-12 opacity-50" strokeWidth={1.5} />
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
                          <Badge variant="greenFill">
                            Бесплатно
                          </Badge>
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

          {/* Если ничего не найдено */}
          {filteredCourses.length === 0 && filteredLessons.length === 0 && (
            <Card variant="glow" padding="none" className="p-12 text-center">
              <div className="mb-4 flex justify-center"><SearchX className="w-16 h-16 text-gray-300" strokeWidth={1.5} /></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {debouncedSearch ? 'Ничего не найдено' : 'Пока нет материалов'}
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {debouncedSearch 
                  ? `По запросу "${debouncedSearch}" материалов не найдено. Попробуйте изменить поисковый запрос.`
                  : 'Создайте свой первый урок или курс, чтобы начать делиться знаниями'
                }
              </p>
              {!debouncedSearch && (
                <div className="flex flex-wrap justify-center gap-3">
                  <Button href="/dashboard/mentor/lessons/new">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Создать материал
                  </Button>
                  <Button href="/dashboard/mentor/courses" variant="outline">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Мои курсы
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Вкладка: Настройки (скрытая, доступна только через кнопку для владельца) */}
      {activeTab === 'settings' && isOwner && (
        <div className="space-y-6">
          {/* Кнопка назад к профилю */}
          <button
            onClick={() => setActiveTab('profile')}
            className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors mb-4"
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
                <Input size="compact"
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Иван Иванов"
                />
              </div>

              <div>
                <label htmlFor="specialization" className="block text-sm font-semibold text-gray-700 mb-2">
                  Специализация
                </label>
                <Input size="compact"
                  id="specialization"
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="Психолог, бизнес-коуч, преподаватель"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-semibold text-gray-700 mb-2">
                  О себе
                </label>
                <Textarea size="compact"
                  id="bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="resize-none"
                  placeholder="Расскажите о себе, своём опыте и подходе..."
                />
              </div>

              <div>
                <FileUploader
                  currentFile={avatarUrl}
                  onFileUpload={(url) => setAvatarUrl(url)}
                  entityType="profile_cover"
                  label="Аватар"
                  hint="PNG, JPG до 5MB (рекомендуется 400×400px, 1:1)"
                />
              </div>

              <div className="flex items-start justify-between gap-4 pt-5 border-t border-purple-100">
                <div>
                  <label htmlFor="isPublic" className="block text-sm font-semibold text-gray-700">
                    Открытый профиль
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Когда выключено, профиль видите только вы и админ, остальные видят «Профиль скрыт»
                  </p>
                </div>
                <button
                  id="isPublic"
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${isPublic ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`}
                    style={{ marginTop: '4px' }}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-purple-100">
              <Button type="submit" loading={saving} size="lg">
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </form>

          {/* Ф3: платная подписка — отдельная форма. Пока админ не включил
              продажи (рубильник), цена и кнопка неактивны: ментор должен видеть,
              ЧТО закрыто и КАК это открыть (договор с площадкой). */}
          <form onSubmit={handleSavePrice} className="style-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <Lock className="w-5 h-5" strokeWidth={1.5} />
              </span>
              Платная подписка
            </h2>

            <div className="space-y-5">
              <div
                className={`rounded-xl p-4 border ${
                  paidPublishingAllowed
                    ? 'bg-purple-50/50 border-purple-100'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {!paidPublishingAllowed && (
                      <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-700">Продажа платного контента</div>
                      {paidPublishingAllowed ? (
                        <p className="text-sm text-gray-500 mt-1">
                          Включено администратором. Ваши платные материалы можно открывать по подписке.
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">
                          Платные уроки, курсы и подписка на вас <b>пока недоступны</b>. Как подключить —
                          в разделе{' '}
                          <Link href="/dashboard/mentor/partner" className="text-purple-700 underline underline-offset-2 hover:text-purple-800">
                            «Партнёрская программа»
                          </Link>
                          : принимаете договор-оферту, подаёте заявку — администратор включит продажи.
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${
                      paidPublishingAllowed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-white text-gray-600 border border-gray-300'
                    }`}
                  >
                    {paidPublishingAllowed ? 'Включено' : 'Выключено'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="subscriptionPrice" className="block text-sm font-semibold text-gray-700">
                    Цена подписки на вас, ₽/мес
                  </label>
                  {savedPrice !== '' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                      Текущая цена: {savedPrice} ₽/мес
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Ученики смогут оформлять подписку на 1, 6 или 12 месяцев по этой цене за месяц.
                  Оставьте пустым, если подписку предлагать не хотите.
                </p>
                <div className="mt-2 max-w-48 relative">
                  <Input
                    id="subscriptionPrice"
                    type="number"
                    size="compact"
                    min={99}
                    max={9990}
                    step={1}
                    disabled={!paidPublishingAllowed}
                    value={subscriptionPrice}
                    onChange={(e) => setSubscriptionPrice(e.target.value)}
                    placeholder="например, 499"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₽</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-purple-100">
              <Button
                type="submit"
                loading={priceSaving}
                disabled={!paidPublishingAllowed}
                size="lg"
              >
                Сохранить цену
              </Button>
              {!paidPublishingAllowed && (
                <span className="text-sm text-gray-500">
                  Сохранение недоступно, пока продажи не включены
                </span>
              )}
              {paidPublishingAllowed && priceSaved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <Check className="w-4 h-4" strokeWidth={2} />
                  Сохранено
                </span>
              )}
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
                <Input size="compact"
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Подтвердите пароль *
                </label>
                <Input size="compact"
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-purple-100">
              <button
                type="submit"
                disabled={passwordSaving}
                className="bg-gray-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? 'Изменение...' : 'Изменить пароль'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}