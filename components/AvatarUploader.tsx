'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AvatarUploaderProps {
  currentAvatar?: string | null
  displayName?: string | null
  coachId?: string
  onAvatarUpload: (url: string) => void
}

export default function AvatarUploader({
  currentAvatar,
  displayName,
  coachId,
  onAvatarUpload
}: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const getInitials = (name?: string | null) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    setUploading(true)

    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `avatar_${coachId || Date.now()}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars') // или 'covers', если решил не создавать новый бакет
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Обновляем запись в БД
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ avatar_url: publicUrl })
        .eq('id', coachId)

      if (updateError) throw updateError

      onAvatarUpload(publicUrl)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Ошибка при загрузке аватара')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative group inline-block">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
        {currentAvatar ? (
          <img 
            src={currentAvatar} 
            alt="Avatar" 
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl sm:text-3xl font-bold text-purple-600">
            {getInitials(displayName)}
          </span>
        )}
      </div>
      
      {/* Оверлей при наведении */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-30"
        title="Изменить аватар"
      >
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}