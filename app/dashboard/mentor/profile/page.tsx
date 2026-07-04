'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfileSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Данные профиля
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [coachId, setCoachId] = useState<string>('')

  // Данные для смены пароля
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    console.log('[Profile] Starting to load profile...')
    const startTime = Date.now()
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      console.log('[Profile] Auth getUser took:', Date.now() - startTime, 'ms')
      
      if (userError) {
        console.error('[Profile] Auth error:', userError)
        throw userError
      }
      
      if (!user) {
        console.log('[Profile] No user, redirecting to login')
        router.push('/login')
        return
      }

      console.log('[Profile] Loading profile for user:', user.id)

      const coachesStartTime = Date.now()
      const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id, display_name, bio, specialization')
        .eq('user_id', user.id)
        .single()

      console.log('[Profile] Coaches query took:', Date.now() - coachesStartTime, 'ms')

      if (coachError) {
        console.error('[Profile] Coach query error:', coachError)
        throw coachError
      }

      console.log('[Profile] Coach data loaded:', coach)

      if (coach) {
        setCoachId(coach.id)
        setDisplayName(coach.display_name || '')
        setBio(coach.bio || '')
        setSpecialization(coach.specialization || '')
      }
      
      console.log('[Profile] Total load time:', Date.now() - startTime, 'ms')
    } catch (error: any) {
      console.error('[Profile] Error in loadProfile:', error)
      setError(error.message || 'Ошибка загрузки профиля')
    } finally {
      setLoading(false)
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
        })
        .eq('id', coachId)

      if (error) throw error

      setSuccess('Профиль успешно обновлён!')
      
      // Отправляем событие для обновления Navbar
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { displayName } 
      }))
      
      // Очищаем сообщение через 3 секунды
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
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setError(error.message || 'Ошибка при смене пароля')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/mentor" className="hover:text-blue-600">
          Кабинет наставника
        </Link>
        <span>/</span>
        <span className="text-gray-900">Настройки профиля</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Настройки профиля
      </h1>

      {/* Уведомления */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      {/* Основная информация */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Основная информация
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Имя для отображения *
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Иван Иванов"
              />
              <p className="text-sm text-gray-500 mt-1">
                Это имя будет видно другим пользователям
              </p>
            </div>

            <div>
              <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
                Специализация
              </label>
              <input
                id="specialization"
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Психолог, бизнес-коуч, преподаватель английского"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                О себе
              </label>
              <textarea
                id="bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Расскажите о себе, своём опыте и подходе..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>

      {/* Смена пароля */}
      <form onSubmit={handleChangePassword} className="mt-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Смена пароля
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Новый пароль *
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Минимум 8 символов"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Подтвердите пароль *
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Повторите пароль"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:bg-gray-400"
          >
            {saving ? 'Изменение...' : 'Изменить пароль'}
          </button>
        </div>
      </form>
    </main>
  )
}