'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FileUploaderProps {
  currentFile?: string | null
  onFileUpload: (fileUrl: string, fileName: string) => void
  entityId?: string
  entityType: 'lesson_cover' | 'course_cover' | 'lesson_content'
  acceptedTypes?: string[]
  maxSizeMB?: number
  label?: string
  placeholder?: string
}

export default function FileUploader({
  currentFile,
  onFileUpload,
  entityId,
  entityType,
  acceptedTypes = ['image/*'],
  maxSizeMB = 5,
  label,
  placeholder
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentFile || null)
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const getBucketName = () => {
    if (entityType === 'lesson_cover' || entityType === 'course_cover') return 'covers'
    return 'lesson_files'
  }

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`Файл слишком большой. Максимальный размер ${maxSizeMB}MB`)
      return
    }

    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    
    if (!isImage && !isPdf && acceptedTypes[0] !== '*/*') {
      alert('Неподдерживаемый тип файла')
      return
    }

    setUploading(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
        setFileName(file.name)
      }
      reader.readAsDataURL(file)

      const fileExt = file.name.split('.').pop() || (isPdf ? 'pdf' : 'png')
      const bucketName = getBucketName()
      const fileName = `${entityType}_${entityId || Date.now()}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      onFileUpload(publicUrl, file.name)
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Ошибка при загрузке файла')
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
  const isPdfFile = preview && acceptedTypes.some(type => type.includes('pdf'))

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-purple-200 group shadow-sm">
          {isImageFile ? (
            <div className="aspect-video">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : isPdfFile ? (
            <div className="bg-red-50 p-8 flex flex-col items-center justify-center">
              <div className="text-6xl mb-3">📄</div>
              <p className="text-sm font-medium text-gray-700">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">PDF документ</p>
            </div>
          ) : (
            <div className="aspect-video bg-purple-50 flex items-center justify-center">
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
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging
              ? 'border-purple-600 bg-purple-100/50 scale-[1.02]'
              : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50/30'
          }`}
          style={{ minHeight: '200px' }}
        >
          <div className={`w-16 h-16 gradient-icon rounded-full flex items-center justify-center text-white text-2xl mb-3 transition-transform ${
            isDragging ? 'scale-110' : 'hover:scale-110'
          } shadow-lg`}>
            {acceptedTypes.some(t => t.includes('pdf')) ? '📄' : '📷'}
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1 text-center">
            {isDragging ? 'Отпустите файл здесь' : (placeholder || 'Нажмите, перетащите или вставьте скриншот')}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            {acceptedTypes.some(t => t.includes('pdf')) ? 'PDF' : 'PNG, JPG'} до {maxSizeMB}MB<br />
            <span className="text-purple-600 font-medium">💡 Можно вставить Ctrl+V</span>
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}