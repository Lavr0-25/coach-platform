'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CoverImageUploaderProps {
  currentImage?: string | null
  onImageUpload: (imageUrl: string) => void
  entityId?: string
  entityType: 'lesson' | 'course'
}

export default function CoverImageUploader({
  currentImage,
  onImageUpload,
  entityId,
  entityType
}: CoverImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    setUploading(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      const fileExt = file.name.split('.').pop()
      const fileName = `${entityType}_${entityId || Date.now()}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(fileName)

      onImageUpload(publicUrl)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Ошибка при загрузке изображения')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setPreview(null)
    onImageUpload('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        Обложка {entityType === 'lesson' ? 'урока' : 'курса'}
      </label>
      
      {preview ? (
        <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-purple-200 group shadow-sm">
          <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 text-sm"
            >
              {uploading ? 'Загрузка...' : 'Заменить'}
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={uploading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="aspect-video border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50/30 transition-all group"
        >
          <div className="w-16 h-16 gradient-icon rounded-full flex items-center justify-center text-white text-2xl mb-3 group-hover:scale-110 transition-transform shadow-lg">
            📷
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Нажмите, чтобы загрузить обложку</p>
          <p className="text-xs text-gray-500">PNG, JPG до 5MB (рекомендуется 1280x720)</p>
        </div>
      )}

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