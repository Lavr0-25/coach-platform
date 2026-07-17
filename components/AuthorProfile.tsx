'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface AuthorProfileProps {
  coach: {
    id: string
    user_id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
    bio: string | null
    specialization: string | null
    telegram_link: string | null
    website_link: string | null
    subscribers_count?: number
    lessons_count?: number
  }
  isOwner: boolean
  isSubscribed?: boolean
  onSubscribe?: () => void
}

export default function AuthorProfile({
  coach,
  isOwner,
  isSubscribed,
  onSubscribe
}: AuthorProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  // Состояния для редактирования
  const [displayName, setDisplayName] = useState(coach.display_name || '')
  const [bio, setBio] = useState(coach.bio || '')
  const [specialization, setSpecialization] = useState(coach.specialization || '')
  const [telegramLink, setTelegramLink] = useState(coach.telegram_link || '')
  const [websiteLink, setWebsiteLink] = useState(coach.website_link || '')

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          display_name: displayName,
          bio,
          specialization,
          telegram_link: telegramLink,
          website_link: websiteLink,
        })
        .eq('id', coach.id)

      if (error) throw error
      setIsEditing(false)
      // Можно добавить обновление страницы или state
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Ошибка при сохранении профиля')
    } finally {
      setIsSaving(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + ' тыс.'
    }
    return num.toString()
  }

  return (
    <div className="style-card p-6 sm:p-8 mb-6">
      {/* Шапка профиля */}
      <div className="flex flex-col sm:flex-row gap-6 mb-6">
        {/* Аватар */}
        <div className="relative flex-shrink-0">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-purple-200 shadow-lg">
            {coach.avatar_url ? (
              <img
                src={coach.avatar_url}
                alt={coach.display_name || ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full gradient-icon flex items-center justify-center text-white text-4xl sm:text-5xl font-bold">
                {coach.display_name?.charAt(0).toUpperCase() || 'A'}
              </div>
            )}
          </div>
        </div>

        {/* Информация */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 w-full px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ваше имя"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-1">
                  {coach.display_name || 'Автор'}
                </h1>
              )}
              
              {coach.username && (
                <p className="text-gray-500 text-sm mb-2">@{coach.username}</p>
              )}
            </div>

            {/* Кнопки действий */}
            <div className="flex gap-2">
              {isOwner ? (
                isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="gradient-btn text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-purple-500/30 disabled:opacity-50"
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-white text-gray-700 border border-purple-200 px-4 py-2 rounded-lg font-medium hover:bg-purple-50"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-white text-purple-700 border border-purple-200 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Редактировать
                  </button>
                )
              ) : (
                <button
                  onClick={onSubscribe}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    isSubscribed
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                  }`}
                >
                  {isSubscribed ? '✓ Подписан' : 'Подписаться'}
                </button>
              )}
            </div>
          </div>

          {/* Статистика */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
            {coach.subscribers_count !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {formatNumber(coach.subscribers_count)} подписчиков
              </span>
            )}
            {coach.lessons_count !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {coach.lessons_count} {coach.lessons_count === 1 ? 'урок' : coach.lessons_count < 5 ? 'урока' : 'уроков'}
              </span>
            )}
          </div>

          {/* Ссылки */}
          <div className="flex flex-wrap gap-2">
            {coach.telegram_link && (
              <a
                href={coach.telegram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            )}
            {coach.website_link && (
              <a
                href={coach.website_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Сайт
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Описание / Биография */}
      <div className="border-t border-purple-100 pt-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Специализация
              </label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Например: Психолог, бизнес-коуч"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                О себе
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Расскажите о себе..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ссылка на Telegram
              </label>
              <input
                type="url"
                value={telegramLink}
                onChange={(e) => setTelegramLink(e.target.value)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://t.me/username"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ссылка на сайт
              </label>
              <input
                type="url"
                value={websiteLink}
                onChange={(e) => setWebsiteLink(e.target.value)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://example.com"
              />
            </div>
          </div>
        ) : (
          <div>
            {coach.specialization && (
              <p className="text-gray-700 font-medium mb-2">{coach.specialization}</p>
            )}
            {coach.bio && (
              <p className="text-gray-600 leading-relaxed">{coach.bio}</p>
            )}
            {!coach.bio && !coach.specialization && (
              <p className="text-gray-400 italic">Описание пока не заполнено</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}