'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

// Статус-чипы — семантический цвет в рамке, как во всей админке
const chip = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border'

export default function LessonsList({ initialLessons }: { initialLessons: any[] }) {
  const [lessons, setLessons] = useState(initialLessons || [])
  const [loading, setLoading] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    price: 0,
    is_free_preview: false
  })
  const { showToast } = useToast()

  const handleDelete = async (lessonId: string, lessonTitle: string) => {
    if (!confirm(`Удалить урок "${lessonTitle}"? Это действие нельзя отменить.`)) return

    setLoading(lessonId)

    const supabase = createClient()

    // Сначала удаляем контент урока
    await supabase
      .from('lesson_content')
      .delete()
      .eq('lesson_id', lessonId)

    // Затем удаляем сам урок
    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId)

    if (error) {
      console.error('Error deleting lesson:', error)
      showToast('Ошибка при удалении урока', 'error')
    } else {
      // Обновляем список
      setLessons(lessons.filter(l => l.id !== lessonId))
      showToast('Урок удалён', 'success')
    }

    setLoading(null)
  }

  const handleEdit = (lesson: any) => {
    setEditingLesson(lesson)
    setEditData({
      title: lesson.title || '',
      description: lesson.description || '',
      price: lesson.price || 0,
      is_free_preview: lesson.is_free_preview || false
    })
    setShowEditModal(true)
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLesson) return

    setLoading(editingLesson.id)
    setShowEditModal(false)

    const supabase = createClient()
    const { error } = await supabase
      .from('lessons')
      .update(editData)
      .eq('id', editingLesson.id)

    if (error) {
      console.error('Error updating lesson:', error)
      showToast('Ошибка при обновлении урока', 'error')
    } else {
      // Обновляем список
      setLessons(lessons.map(l =>
        l.id === editingLesson.id ? { ...l, ...editData } : l
      ))
      showToast('Урок обновлён', 'success')
    }

    setLoading(null)
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-purple-100 bg-gray-50">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            📄 Все уроки
          </h2>
        </div>

        {lessons.length > 0 ? (
          <div className="divide-y divide-purple-50">
            {lessons.map((lesson) => {
              const coach = lesson.coaches
              const content = lesson.lesson_content?.[0]
              const isFree = lesson.price === 0 || lesson.is_free_preview

              return (
                <div key={lesson.id} className="p-4 md:p-6 hover:bg-purple-50/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {lesson.title}
                        </h3>
                        {isFree ? (
                          <span className={`${chip} bg-green-50 text-green-700 border-green-200`}>
                            🆓 Бесплатно
                          </span>
                        ) : (
                          <span className={`${chip} bg-purple-50 text-purple-700 border-purple-200`}>
                            💰 {lesson.price} ₽
                          </span>
                        )}
                        {lesson.is_free_preview && (
                          <span className={`${chip} bg-blue-50 text-blue-700 border-blue-200`}>
                            🎁 Превью
                          </span>
                        )}
                      </div>

                      {lesson.description && (
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                          {lesson.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>👨‍🏫 {coach?.display_name || 'Неизвестно'}</span>
                        <span>📅 {new Date(lesson.created_at).toLocaleDateString('ru-RU')}</span>
                        {content && (
                          <span>📄 {content.content_type}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:ml-4">
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-50 transition-colors"
                      >
                        👁️ Просмотр
                      </Link>
                      <button
                        onClick={() => handleEdit(lesson)}
                        disabled={loading === lesson.id}
                        className="gradient-btn text-white px-4 py-2 rounded-xl text-sm font-medium shadow-md shadow-purple-500/30 disabled:opacity-50 transition-opacity"
                      >
                        {loading === lesson.id ? '⏳...' : '✏️ Редактировать'}
                      </button>
                      <button
                        onClick={() => handleDelete(lesson.id, lesson.title)}
                        disabled={loading === lesson.id}
                        className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {loading === lesson.id ? '⏳...' : '🗑️ Удалить'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <div className="text-5xl mb-3">📚</div>
            <p className="text-lg font-semibold text-gray-900">Ничего не найдено</p>
            <p className="text-sm mt-1">Попробуйте изменить поиск или фильтр</p>
          </div>
        )}
      </div>

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-purple-100" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
              Редактировать урок
            </h2>

            <form onSubmit={submitEdit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название урока *
                </label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цена (₽)
                  </label>
                  <input
                    type="number"
                    value={editData.price}
                    onChange={(e) => setEditData({ ...editData, price: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editData.is_free_preview}
                      onChange={(e) => setEditData({ ...editData, is_free_preview: e.target.checked })}
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Бесплатный превью
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-btn text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-opacity"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}