'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FileUploadProps {
  onFileUpload: (url: string, fileName: string) => void
  existingFileUrl?: string
  acceptedTypes?: string[]
  maxSizeMB?: number
  label?: string
}

export default function FileUpload({
  onFileUpload,
  existingFileUrl,
  acceptedTypes = ['image/*', 'application/pdf'],
  maxSizeMB = 10,
  label = 'Загрузка файла'
}: FileUploadProps) {
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Инициализация превью, если файл уже загружен
  useEffect(() => {
    if (existingFileUrl) {
      setFileName(decodeURIComponent(existingFileUrl.split('/').pop() || 'Файл'))
      if (acceptedTypes.some(type => type.includes('image'))) {
        setPreview(existingFileUrl)
      }
    }
  }, [existingFileUrl, acceptedTypes])

  const handleFile = async (file: File) => {
    setError('')

    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSizeMB) {
      setError(`Файл слишком большой. Максимум ${maxSizeMB} MB`)
      return
    }

    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    
    if (!isImage && !isPdf) {
      setError('Неподдерживаемый тип файла. Разрешены только изображения и PDF.')
      return
    }

    setUploading(true)

    try {
      // Создаем превью для изображений
      if (isImage) {
        const reader = new FileReader()
        reader.onloadend = () => setPreview(reader.result as string)
        reader.readAsDataURL(file)
      }
      setFileName(file.name)

      const fileExt = file.name.split('.').pop() || (isPdf ? 'pdf' : 'png')
      const filePath = `content_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('lesson-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('lesson-files')
        .getPublicUrl(filePath)

      onFileUpload(publicUrl, file.name)
    } catch (error: any) {
      console.error('Upload error:', error)
      setError(error.message || 'Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await handleFile(file)
    }
  }

  // Drag and Drop
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
      await handleFile(files[0])
    }
  }

  // Вставка из буфера обмена (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        if (blob) {
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' })
          await handleFile(file)
          break
        }
      }
    }
  }

  const handleRemoveFile = () => {
    setPreview(null)
    setFileName('')
    onFileUpload('', '')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isImageFile = preview && acceptedTypes.some(type => type.includes('image'))
  const isPdfFile = !isImageFile && (fileName.endsWith('.pdf') || acceptedTypes.some(type => type.includes('pdf')))

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}
      
      {preview || fileName ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-purple-200 group shadow-sm">
          {isImageFile ? (
            <div className="aspect-video">
              <img src={preview!} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : isPdfFile ? (
            <div className="bg-red-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
              <div className="text-6xl mb-3">📄</div>
              <p className="text-sm font-medium text-gray-700 text-center break-all px-4">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">PDF документ</p>
            </div>
          ) : (
            <div className="aspect-video bg-purple-50 flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <div className="text-4xl mb-2">📎</div>
                <p className="text-sm font-medium text-gray-700">{fileName}</p>
              </div>
            </div>
          )}
          
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
              onClick={handleRemoveFile}
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
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px] ${
            isDragging
              ? 'border-purple-600 bg-purple-100/50 scale-[1.02]'
              : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50/30'
          }`}
        >
          <div className={`w-16 h-16 gradient-icon rounded-full flex items-center justify-center text-white text-2xl mb-3 transition-transform ${
            isDragging ? 'scale-110' : 'group-hover:scale-110'
          } shadow-lg`}>
            {acceptedTypes.some(t => t.includes('pdf')) ? '📄' : '📷'}
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1 text-center">
            {isDragging ? 'Отпустите файл здесь' : 'Нажмите, перетащите или вставьте скриншот'}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            {acceptedTypes.some(t => t.includes('pdf')) ? 'PDF' : 'PNG, JPG'} до {maxSizeMB}MB<br />
            <span className="text-purple-600 font-medium">💡 Можно вставить Ctrl+V</span>
          </p>
        </div>
      )}

      {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />
    </div>
  )
}