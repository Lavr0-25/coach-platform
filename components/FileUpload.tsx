'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FileUploadProps {
  onFileUpload: (url: string, fileName: string) => void
  existingFileUrl?: string
  acceptedTypes?: string[]
  maxSizeMB?: number
}

export default function FileUpload({
  onFileUpload,
  existingFileUrl,
  acceptedTypes = ['image/*', 'application/pdf'],
  maxSizeMB = 10,
}: FileUploadProps) {
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    // Проверка размера
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSizeMB) {
      setError(`Файл слишком большой. Максимум ${maxSizeMB} MB`)
      return
    }

    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setProgress(0)

    try {
      // Генерируем уникальное имя файла
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      // Загружаем файл
      const { data, error } = await supabase.storage
        .from('lesson-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('lesson-files')
        .getPublicUrl(filePath)

      onFileUpload(publicUrl, file.name)
      setProgress(100)
    } catch (error: any) {
      console.error('Upload error:', error)
      setError(error.message || 'Ошибка загрузки файла')
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }

  const getFileIcon = (url: string) => {
    if (url.includes('.pdf')) return '📄'
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '🖼️'
    return '📎'
  }

  return (
    <div className="space-y-3">
      {/* Кнопка загрузки */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Загрузка...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Выбрать файл
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />

        {progress > 0 && (
          <div className="flex-1">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {/* Информация о загруженном файле */}
      {existingFileUrl && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-2xl">{getFileIcon(existingFileUrl)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {decodeURIComponent(existingFileUrl.split('/').pop() || 'Файл')}
            </p>
          </div>
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Открыть
          </a>
        </div>
      )}

      {/* Подсказка */}
      <p className="text-sm text-gray-500">
        Максимальный размер: {maxSizeMB} MB
      </p>
    </div>
  )
}