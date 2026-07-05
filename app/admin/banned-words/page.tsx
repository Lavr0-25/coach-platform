'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface BannedWord {
  id: string
  word: string
  created_at: string
}

export default function BannedWordsPage() {
  const supabase = createClient()
  const [words, setWords] = useState<BannedWord[]>([])
  const [loading, setLoading] = useState(true)
  const [newWord, setNewWord] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadWords()
  }, [])

  const loadWords = async () => {
    try {
      const { data, error } = await supabase
        .from('banned_words')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setWords(data || [])
    } catch (error) {
      console.error('Error loading banned words:', error)
      alert('Ошибка при загрузке списка слов')
    } finally {
      setLoading(false)
    }
  }

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newWord.trim()) {
      alert('Введите слово')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('banned_words')
        .insert({
          word: newWord.trim().toLowerCase(),
        })

      if (error) {
        if (error.code === '23505') {
          alert('Это слово уже есть в списке')
        } else {
          throw error
        }
        return
      }

      setNewWord('')
      await loadWords()
      alert('✅ Слово добавлено в список запрещённых')
    } catch (error: any) {
      console.error('Error adding word:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось добавить слово'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteWord = async (id: string) => {
    if (!confirm('Удалить это слово из списка?')) return

    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadWords()
      alert('Слово удалено')
    } catch (error: any) {
      console.error('Error deleting word:', error)
      alert('Ошибка при удалении')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🚫 Запрещённые слова</h1>
            <p className="text-gray-600 mt-1">
              Управление списком запрещённых слов для комментариев и отзывов
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            ← Назад
          </Link>
        </div>

        {/* Форма добавления */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Добавить новое слово
          </h2>
          
          <form onSubmit={handleAddWord} className="flex gap-3">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Введите слово или фразу..."
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400"
            >
              {submitting ? 'Добавление...' : 'Добавить'}
            </button>
          </form>
          
          <p className="text-sm text-gray-500 mt-2">
            💡 Слова проверяются без учёта регистра. Можно добавлять целые фразы.
          </p>
        </div>

        {/* Список слов */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : words.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border divide-y">
            {words.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-lg">
                    {item.word}
                  </p>
                  <p className="text-sm text-gray-500">
                    Добавлено: {formatDate(item.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteWord(item.id)}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Список пуст
            </h2>
            <p className="text-gray-600">
              Нет запрещённых слов. Добавьте первое слово выше.
            </p>
          </div>
        )}

        {/* Статистика */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Как это работает:</strong> Когда пользователь пытается оставить комментарий или отзыв, 
            система проверяет текст на наличие запрещённых слов. Если найдено совпадение — 
            публикация блокируется с сообщением об ошибке.
          </p>
        </div>
      </div>
    </main>
  )
}