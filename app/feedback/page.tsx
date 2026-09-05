'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { updateMyFeedback, deleteMyFeedback } from '@/app/actions/feedbackActions'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea, Label } from '@/components/ui/Input'
import type { BadgeProps } from '@/components/ui/Badge'
import { Bug, Lightbulb, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'

// Статусы и подписи — как в админке (/admin/feedback), чтобы пользователь
// видел то же самое, что видит админ
const STATUS_META: Record<string, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  new: { label: 'Новое', variant: 'blue' },
  in_progress: { label: 'В работе', variant: 'yellow' },
  resolved: { label: 'Решено', variant: 'green' },
  rejected: { label: 'Отклонено', variant: 'red' },
}

const TYPE_META: Record<string, { icon: React.ReactNode; label: string }> = {
  bug: { icon: <Bug className="w-4 h-4" />, label: 'Ошибка' },
  feature: { icon: <Lightbulb className="w-4 h-4" />, label: 'Идея' },
}

export default function FeedbackPage() {
  const [type, setType] = useState<'bug' | 'feature'>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [successText, setSuccessText] = useState('')
  const [user, setUser] = useState<any>(null)
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Лимит скриншотов на обращение (пожелание из фидбека: «нужно 5, а не 3»)
  const MAX_IMAGES = 5

  // История своих обращений: только свои (фильтр по user_id), новые сверху
  const loadMyFeedbacks = async (userId: string) => {
    setListLoading(true)
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setMyFeedbacks(data || [])
    setListLoading(false)
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (!user) {
        router.push('/login')
        return
      }
      loadMyFeedbacks(user.id)
    }
    getUser()
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')

    try {
      // Сколько слотов осталось до лимита
      const freeSlots = MAX_IMAGES - images.length
      const selected = Array.from(files)

      if (selected.length > freeSlots) {
        setError(`Максимум ${MAX_IMAGES} скриншотов на обращение`)
      }

      for (const file of selected.slice(0, freeSlots)) {
        // Проверка размера (макс 5MB) — неподходящие файлы пропускаем, не срывая загрузку остальных
        if (file.size > 5 * 1024 * 1024) {
          setError(`«${file.name}» больше 5MB — файл пропущен`)
          continue
        }

        // Проверка типа файла
        if (!file.type.startsWith('image/')) {
          setError(`«${file.name}» не изображение — файл пропущен`)
          continue
        }

        // Создаем уникальный путь
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `feedback/${fileName}`

        // Загружаем в Storage
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Получаем публичную ссылку
        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath)

        setImages(prev => [...prev, publicUrl])
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Ошибка при загрузке изображения')
    } finally {
      setUploading(false)
      // Очищаем input
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (!user) {
        setError('Пожалуйста, войдите в систему')
        setIsLoading(false)
        return
      }

      // Режим правки: сохраняем через server action (проверка владельца на сервере)
      if (editingId) {
        const res = await updateMyFeedback(editingId, {
          type,
          title,
          description,
          images: images.length > 0 ? images : null,
        })
        if (!res.ok) {
          setError(res.error)
          setIsLoading(false)
          return
        }
        setSuccessText('Изменения сохранены.')
        setSuccess(true)
        setEditingId(null)
        setTitle('')
        setDescription('')
        setImages([])
        loadMyFeedbacks(user.id)
        return
      }

      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          user_name: user.email || 'Аноним',
          type,
          title,
          description,
          images: images.length > 0 ? images : null,
          status: 'new'
        })

      if (error) throw error

      setSuccessText('Ваше обращение успешно отправлено.')
      setSuccess(true)
      setTitle('')
      setDescription('')
      setImages([])
      loadMyFeedbacks(user.id)
    } catch (err: any) {
      console.error('Error submitting feedback:', err)
      setError(err.message || 'Ошибка при отправке')
    } finally {
      setIsLoading(false)
    }
  }

  // Редактирование: заполняем форму данными обращения
  const startEdit = (fb: any) => {
    setEditingId(fb.id)
    setType(fb.type)
    setTitle(fb.title)
    setDescription(fb.description || '')
    setImages(fb.images || [])
    setSuccess(false)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setImages([])
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Удаление в два клика: первый подсвечивает кнопку, второй удаляет
  // (нативные confirm() в проекте не используем)
  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    const res = await deleteMyFeedback(id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (editingId === id) cancelEdit()
    if (user) loadMyFeedbacks(user.id)
  }

  if (!user) {
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
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:text-purple-600 transition-colors">Главная</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Обратная связь</span>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
          Обратная связь
        </h1>
        <p className="text-gray-600">
          Помогите нам стать лучше — расскажите о проблеме или предложите новую идею
        </p>
      </div>

      <Card variant="glow" padding="none" className="p-6 sm:p-8">
        {/* Режим правки — подсказка, что форма сейчас изменяет существующее обращение */}
        {editingId && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Вы редактируете обращение. Изменить его можно, пока оно в статусе «Новое».</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Выбор типа */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Тип обращения
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('feature')}
                className={`px-4 py-4 rounded-xl border-2 transition-colors flex items-center justify-center gap-3 font-medium ${
                  type === 'feature'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <Lightbulb className="w-6 h-6" />
                <span>Предложить идею</span>
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`px-4 py-4 rounded-xl border-2 transition-colors flex items-center justify-center gap-3 font-medium ${
                  type === 'bug'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <Bug className="w-6 h-6" />
                <span>Сообщить об ошибке</span>
              </button>
            </div>
          </div>

          {/* Заголовок */}
          <div>
            <Label htmlFor="fb-title" required>Заголовок</Label>
            <Input
              id="fb-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                // После успешной отправки первое же изменение текста возвращает
                // форму в рабочее состояние — можно отправить новое обращение
                if (success) setSuccess(false)
              }}
              required
              maxLength={200}
              placeholder={type === 'bug' ? 'Краткое описание ошибки' : 'Название вашей идеи'}
            />
          </div>

          {/* Описание */}
          <div>
            <Label htmlFor="fb-description" required>Описание</Label>
            <Textarea
              id="fb-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (success) setSuccess(false)
              }}
              required
              rows={6}
              placeholder={
                type === 'bug'
                  ? 'Опишите, что произошло, шаги для воспроизведения и ожидаемый результат...'
                  : 'Опишите вашу идею подробно: что это, зачем нужно и как это поможет платформе...'
              }
              className="resize-none"
            />
          </div>

          {/* Загрузка изображений */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Скриншоты и изображения {images.length > 0 && <span className="text-gray-400 font-normal">({images.length})</span>}
            </label>
            
            {/* Превью загруженных изображений */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                {images.map((img, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-100 group">
                    <img
                      src={img}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Кнопка загрузки */}
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-50/30 transition-colors ${images.length >= MAX_IMAGES || uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-2"></div>
                    <p className="text-sm text-gray-500">Загрузка...</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold text-purple-600">Нажмите для загрузки</span> или перетащите файл
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {images.length >= MAX_IMAGES
                        ? `Достигнут лимит — ${MAX_IMAGES} скриншотов`
                        : `PNG, JPG, GIF (макс. 5MB, до ${MAX_IMAGES} файлов)`}
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading || images.length >= MAX_IMAGES}
                className="hidden"
              />
            </label>
          </div>

          {/* Сообщения */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold">{successText}</p>
                {!editingId && (
                  <p className="text-sm mt-1">Оно появилось в списке «Мои обращения» ниже.</p>
                )}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={success || uploading}
              className="flex-1"
            >
              {success ? 'Готово!' : editingId ? 'Сохранить изменения' : 'Отправить обращение'}
            </Button>
            {editingId ? (
              <Button variant="outline" size="lg" onClick={cancelEdit}>
                Отменить правку
              </Button>
            ) : (
              <Button variant="outline" size="lg" href="/">
                Отмена
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* ─── Мои обращения: история со статусами ─── */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Мои обращения</h2>
        <p className="text-gray-500 text-sm mb-6">
          Статус обновляется, когда админ возьмёт обращение в работу. Пока обращение «Новое»,
          его можно отредактировать или удалить.
        </p>

        {listLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : myFeedbacks.length === 0 ? (
          <Card variant="glow" padding="none" className="p-8 text-center text-gray-500">
            Вы ещё ничего не отправляли — первое обращение появится здесь.
          </Card>
        ) : (
          <div className="space-y-4">
            {myFeedbacks.map((fb) => {
              const status = STATUS_META[fb.status] || STATUS_META.new
              const type = TYPE_META[fb.type] || TYPE_META.feature
              const canEdit = fb.status === 'new'
              const images: string[] = fb.images || []
              return (
                <Card key={fb.id} variant="glow" padding="none" className="p-5 sm:p-6">
                  {/* Шапка: тип + заголовок + статус */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-500 mb-1">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                        <span>·</span>
                        {/* Дата в российском формате: 2 сентября 2026.
                            whitespace-nowrap — дата переносится на новую строку
                            целиком, а не по словам в столбик на узких экранах */}
                        <span className="whitespace-nowrap">
                          {new Date(fb.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 break-words">{fb.title}</h3>
                    </div>
                    <Badge variant={status.variant} className="flex-shrink-0">
                      {status.label}
                    </Badge>
                  </div>

                  {/* Описание */}
                  {fb.description && (
                    <p className="text-gray-600 text-sm whitespace-pre-line break-words mb-3">
                      {fb.description}
                    </p>
                  )}

                  {/* Ответ поддержки: виден при любом статусе */}
                  {fb.admin_reply && (
                    <div className="mt-3 p-4 rounded-xl bg-purple-50 border border-purple-100">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                        Ответ поддержки
                        {fb.replied_at && (
                          <span className="font-normal normal-case text-purple-500"> · {new Date(fb.replied_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-line break-words">{fb.admin_reply}</p>
                    </div>
                  )}

                  {/* Миниатюры скриншотов */}
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {images.map((img, i) => (
                        <a
                          key={i}
                          href={img}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-20 h-20 rounded-lg overflow-hidden border border-purple-100 hover:opacity-80 transition-opacity"
                          title="Открыть в новой вкладке"
                        >
                          <img src={img} alt={`Скриншот ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Действия — только пока статус «Новое» */}
                  {canEdit && (
                    <div className="flex items-center gap-3 pt-2 border-t border-purple-50">
                      <button
                        type="button"
                        onClick={() => startEdit(fb)}
                        className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 inline" /> Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(fb.id)}
                        className={`text-sm font-medium transition-colors ${
                          confirmDeleteId === fb.id
                            ? 'text-red-700 font-semibold'
                            : 'text-gray-400 hover:text-red-600'
                        }`}
                      >
                        {confirmDeleteId === fb.id ? 'Точно удалить? Нажмите ещё раз' : <><Trash2 className="w-3.5 h-3.5 inline" /> Удалить</>}
                      </button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}