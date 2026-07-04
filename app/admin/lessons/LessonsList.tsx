'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
      alert('Ошибка при удалении урока')
    } else {
      // Обновляем список
      setLessons(lessons.filter(l => l.id !== lessonId))
      alert('Урок удалён')
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
      alert('Ошибка при обновлении урока')
    } else {
      // Обновляем список
      setLessons(lessons.map(l => 
        l.id === editingLesson.id ? { ...l, ...editData } : l
      ))
      alert('Урок обновлён')
    }
    
    setLoading(null)
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Все уроки
          </h2>
        </div>

        {lessons.length > 0 ? (
          <div className="divide-y">
            {lessons.map((lesson) => {
              const coach = lesson.coaches
              const content = lesson.lesson_content?.[0]
              const isFree = lesson.price === 0 || lesson.is_free_preview

              return (
                <div key={lesson.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {lesson.title}
                        </h3>
                        {isFree ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            🆓 Бесплатно
                          </span>
                        ) : (
                          <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            💰 {lesson.price} ₽
                          </span>
                        )}
                        {lesson.is_free_preview && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
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

                    <div className="flex gap-2 ml-4">
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        👁️ Просмотр
                      </Link>
                      <button
                        onClick={() => handleEdit(lesson)}
                        disabled={loading === lesson.id}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                      >
                        {loading === lesson.id ? '⏳...' : '✏️ Редактировать'}
                      </button>
                      <button
                        onClick={() => handleDelete(lesson.id, lesson.title)}
                        disabled={loading === lesson.id}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400"
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
            <div className="text-6xl mb-4">📚</div>
            <p className="text-lg">Ничего не найдено</p>
          </div>
        )}
      </div>

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цена (₽)
                  </label>
                  <input
                    type="number"
                    value={editData.price}
                    onChange={(e) => setEditData({ ...editData, price: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editData.is_free_preview}
                      onChange={(e) => setEditData({ ...editData, is_free_preview: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Бесплатный превью
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
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