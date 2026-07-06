'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [fileUploading, setFileUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ added: number; exists: number; errors: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Проверяем расширение
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
      alert('Поддерживаются только файлы .txt и .csv')
      return
    }

    setFileUploading(true)
    setUploadResult(null)

    try {
      const text = await file.text()
      
      // Разбиваем по строкам, запятым, точкам с запятой
      const wordsList = text
        .split(/[\n,;\r]+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length > 0)

      if (wordsList.length === 0) {
        alert('Файл пуст или не содержит слов')
        setFileUploading(false)
        return
      }

      // Убираем дубликаты внутри файла
      const uniqueWords = [...new Set(wordsList)]

      let added = 0
      let exists = 0
      let errors = 0

      // Добавляем каждое слово
      for (const word of uniqueWords) {
        const { error } = await supabase
          .from('banned_words')
          .insert({ word })

        if (error) {
          if (error.code === '23505') {
            exists++
          } else {
            errors++
            console.error(`Error adding word "${word}":`, error)
          }
        } else {
          added++
        }
      }

      setUploadResult({ added, exists, errors })
      await loadWords()
      
      // Очищаем input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert('Ошибка при загрузке файла: ' + (error.message || 'Неизвестная ошибка'))
    } finally {
      setFileUploading(false)
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

  const handleClearAll = async () => {
    if (!confirm('⚠️ Вы уверены? Это удалит ВСЕ запрещённые слова!')) return
    if (!confirm('Это действие нельзя отменить. Продолжить?')) return

    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) throw error

      await loadWords()
      alert('Все слова удалены')
    } catch (error: any) {
      console.error('Error clearing all:', error)
      alert('Ошибка при очистке')
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

        {/* Загрузка из файла */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            📁 Массовая загрузка из файла
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Загрузите файл <strong>.txt</strong> или <strong>.csv</strong> со списком запрещённых слов. 
            Каждое слово должно быть на новой строке или разделено запятой/точкой с запятой.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer transition-colors ${
                fileUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              {fileUploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Загрузка...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Выбрать файл
                </>
              )}
            </label>

            {words.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
              >
                🗑️ Очистить всё
              </button>
            )}
          </div>

          {/* Результат загрузки */}
          {uploadResult && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
              <p className="font-medium text-gray-900 mb-1">✅ Загрузка завершена:</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">
                  ➕ Добавлено: <strong>{uploadResult.added}</strong>
                </span>
                <span className="text-yellow-600">
                  ⚠️ Уже было: <strong>{uploadResult.exists}</strong>
                </span>
                {uploadResult.errors > 0 && (
                  <span className="text-red-600">
                    ❌ Ошибок: <strong>{uploadResult.errors}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Пример формата */}
          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">📝 Пример формата файла:</p>
            <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
{`спам
реклама
мат
плохое слово
ещё одно слово`}
            </pre>
          </div>
        </div>

        {/* Форма добавления одного слова */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Добавить одно слово
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
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">
                Всего слов: <strong>{words.length}</strong>
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border divide-y max-h-[600px] overflow-y-auto">
              {words.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
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
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Список пуст
            </h2>
            <p className="text-gray-600">
              Нет запрещённых слов. Добавьте первое слово выше или загрузите файл.
            </p>
          </div>
        )}

        {/* Информация */}
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