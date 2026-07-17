'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AvatarUploader from './AvatarUploader'

interface AuthorProfileHeaderProps {
  coach: {
    id: string
    user_id: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    specialization: string | null
    telegram_link: string | null
    website_link: string | null
  }
  coursesCount: number
  lessonsCount: number
  isOwner: boolean
}

export default function AuthorProfileHeader({ 
  coach, 
  coursesCount, 
  lessonsCount, 
  isOwner 
}: AuthorProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  // Состояния для формы редактирования
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
      alert('Профиль успешно обновлён!')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Ошибка при сохранении профиля')
    } finally {
      setIsSaving(false)
    }
  }

  const getLessonsWord = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'урок'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'урока'
    return 'уроков'
  }

  return (
    <div className="style-card p-6 sm:p-8 mb-8">
      <div className="flex flex-col md:flex-row items-start gap-6">
        {/* Аватар */}
        <div className="flex-shrink-0">
          {isOwner && isEditing ? (
            <AvatarUploader
              currentAvatar={coach.avatar_url}
              displayName={displayName}
              coachId={coach.id}
              onAvatarUpload={() => {}} // Просто обновляем UI, реальный URL сохранится в БД компонентом
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              {coach.avatar_url ? (
                <img 
                  src={coach.avatar_url} 
                  alt={coach.display_name || ''} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl sm:text-5xl font-bold text-purple-600">
                  {coach.display_name?.charAt(0).toUpperCase() || '👤'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Информация */}
        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div className="flex-1">
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
            </div>

            {/* Кнопки действий */}
            {isOwner && (
              <div className="flex gap-2 flex-shrink-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="gradient-btn text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 disabled:opacity-50"
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-white text-gray-700 border border-purple-200 px-5 py-2.5 rounded-xl font-medium hover:bg-purple-50"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-white text-purple-700 border border-purple-200 px-5 py-2.5 rounded-xl font-medium hover:bg-purple-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Редактировать
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Статистика */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-medium">
              <span>📚</span>
              <span>{coursesCount} {coursesCount === 1 ? 'курс' : coursesCount < 5 ? 'курса' : 'курсов'}</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium">
              <span>📖</span>
              <span>{lessonsCount} {getLessonsWord(lessonsCount)}</span>
            </div>
          </div>

          {/* Поля редактирования или отображения */}
          {isEditing ? (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Специализация</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Например: UX/UI Дизайunер"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">О себе</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Расскажите о своём опыте..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Telegram</label>
                  <input
                    type="url"
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="https://t.me/username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Сайт</label>
                  <input
                    type="url"
                    value={websiteLink}
                    onChange={(e) => setWebsiteLink(e.target.value)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {coach.specialization && (
                <p className="text-lg text-gray-700 font-medium mb-3">{coach.specialization}</p>
              )}
              {coach.bio ? (
                <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">О себе</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
                </div>
              ) : isOwner ? (
                <p className="text-gray-400 italic text-sm">Нажмите "Редактировать", чтобы добавить информацию о себе</p>
              ) : null}
              
              {/* Ссылки в режиме просмотра */}
              {!isEditing && (coach.telegram_link || coach.website_link) && (
                <div className="flex flex-wrap gap-3 mt-4">
                  {coach.telegram_link && (
                    <a href={coach.telegram_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Telegram
                    </a>
                  )}
                  {coach.website_link && (
                    <a href={coach.website_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium bg-purple-50 px-4 py-2 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                      Сайт
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}