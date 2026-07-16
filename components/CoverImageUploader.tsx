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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFile = async (file: File) => {
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

      const fileExt = file.name.split('.').pop() || 'png'
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleFile(file)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      await handleFile(file)
    }
  }

  // Paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        if (blob) {
          // Создаём файл с именем по умолчанию
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' })
          await handleFile(file)
          break
        }
      }
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
    <div className="space-y-3" onPaste={handlePaste}>
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group ${
            isDragging
              ? 'border-purple-600 bg-purple-100/50 scale-[1.02]'
              : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50/30'
          }`}
        >
          <div className={`w-16 h-16 gradient-icon rounded-full flex items-center justify-center text-white text-2xl mb-3 transition-transform ${
            isDragging ? 'scale-110' : 'group-hover:scale-110'
          } shadow-lg`}>
            📷
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            {isDragging ? 'Отпустите файл здесь' : 'Нажмите, перетащите или вставьте скриншот'}
          </p>
          <p className="text-xs text-gray-500 text-center px-4">
            PNG, JPG до 5MB (рекомендуется 1280x720)<br />
            <span className="text-purple-600 font-medium">💡 Можно вставить скриншот Ctrl+V</span>
          </p>
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