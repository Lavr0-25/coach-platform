'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MentorProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'settings'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [coachId, setCoachId] = useState<string>('')

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

      const { data: coach } = await supabase
        .from('coaches')
        .select('id, display_name, bio, specialization, avatar_url')
        .eq('user_id', user.id)
        .single()

      if (coach) {
        setCoachId(coach.id)
        setDisplayName(coach.display_name || '')
        setBio(coach.bio || '')
        setSpecialization(coach.specialization || '')
        setAvatarUrl(coach.avatar_url || '')
      }
    } catch (error: any) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await supabase
        .from('coaches')
        .update({
          display_name: displayName,
          bio: bio,
          specialization: specialization,
          avatar_url: avatarUrl,
        })
        .eq('id', coachId)

      setSuccess('Профиль сохранён!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl pt-24">
      <div className="flex border-b border-purple-100 mb-8">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-3 font-medium ${activeTab === 'dashboard' ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500'}`}
        >
          Дашборд
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 font-medium ${activeTab === 'profile' ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500'}`}
        >
          Профиль
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-3 font-medium ${activeTab === 'settings' ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500'}`}
        >
          Настройки
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="style-card p-6">
          <h1 className="text-2xl font-bold gradient-text mb-4">Добро пожаловать, {displayName}!</h1>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/mentor/courses" className="bg-purple-50 p-4 rounded-xl">
              <h3 className="font-bold text-gray-900">Мои курсы</h3>
              <p className="text-sm text-gray-600">Управление курсами</p>
            </Link>
            <Link href="/dashboard/mentor/lessons" className="bg-blue-50 p-4 rounded-xl">
              <h3 className="font-bold text-gray-900">Мои уроки</h3>
              <p className="text-sm text-gray-600">Управление уроками</p>
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="style-card p-6">
          <h2 className="text-xl font-bold mb-4">Мой профиль</h2>
          <div className="text-gray-700">
            <p><strong>Имя:</strong> {displayName}</p>
            {specialization && <p><strong>Специализация:</strong> {specialization}</p>}
            {bio && <p className="mt-4"><strong>О себе:</strong> {bio}</p>}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveProfile} className="style-card p-6 space-y-4">
          <h2 className="text-xl font-bold mb-4">Настройки профиля</h2>
          
          <div>
            <label className="block text-sm font-medium mb-1">Имя</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Специализация</label>
            <input
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">О себе</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-xl"
            />
          </div>

          {error && <div className="text-red-600">{error}</div>}
          {success && <div className="text-green-600">{success}</div>}

          <button
            type="submit"
            disabled={saving}
            className="gradient-btn text-white px-6 py-3 rounded-xl"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      )}
    </main>
  )
}