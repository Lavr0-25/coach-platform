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
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showClearModal, setShowClearModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemsPerPage = 20

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
        .insert({ word: newWord.trim().toLowerCase() })

      if (error) {
        if (error.code === '23505') {
          alert('Это слово уже есть в списке')
        } else {
          throw error
        }
        return
      }

      setNewWord('')
      setCurrentPage(1)
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

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
      alert('Поддерживаются только файлы .txt и .csv')
      return
    }

    setFileUploading(true)
    setUploadResult(null)

    try {
      const text = await file.text()
      
      const wordsList = text
        .split(/[\n,;\r]+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length > 0)

      if (wordsList.length === 0) {
        alert('Файл пуст или не содержит слов')
        setFileUploading(false)
        return
      }

      const uniqueWords = [...new Set(wordsList)]

      let added = 0
      let exists = 0
      let errors = 0

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
      setCurrentPage(1)
      await loadWords()
      
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
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadWords()
    } catch (error: any) {
      console.error('Error deleting word:', error)
      alert('Ошибка при удалении')
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) throw error

      setShowClearModal(false)
      setCurrentPage(1)
      await loadWords()
      alert('✅ Все слова удалены')
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

  // Фильтрация и пагинация
  const filteredWords = words.filter(w => 
    w.word.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / itemsPerPage))
  const paginatedWords = filteredWords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text"> Запрещённые слова</h1>
            <p className="text-gray-600 text-sm mt-1">
              Управление списком запрещённых слов для комментариев и отзывов
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm"
          >
            ← Назад
          </Link>
        </div>

        {/* Массовая загрузка из файла */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-sm"></span>
            Массовая загрузка из файла
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Загрузите файл <strong>.txt</strong> или <strong>.csv</strong> со списком запрещённых слов. 
            Каждое слово должно быть на новой строке или разделено запятой/точкой с запятой.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
              className={`inline-flex items-center gap-2 px-5 py-2.5 gradient-btn text-white rounded-xl font-medium shadow-lg shadow-purple-500/30 cursor-pointer transition-opacity ${
                fileUploading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'
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
                onClick={() => setShowClearModal(true)}
                className="px-4 py-2.5 bg-white border border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-50 transition-colors text-sm"
              >
                🗑️ Очистить всё
              </button>
            )}
          </div>

          {/* Результат загрузки */}
          {uploadResult && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-purple-200 shadow-sm">
              <p className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-green-600">✅</span> Загрузка завершена:
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-green-700 bg-green-50 px-3 py-1 rounded-full font-medium">
                  ➕ Добавлено: <strong>{uploadResult.added}</strong>
                </span>
                <span className="text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full font-medium">
                  ⚠️ Уже было: <strong>{uploadResult.exists}</strong>
                </span>
                {uploadResult.errors > 0 && (
                  <span className="text-red-700 bg-red-50 px-3 py-1 rounded-full font-medium">
                    ❌ Ошибок: <strong>{uploadResult.errors}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Пример формата */}
          <div className="mt-4 p-3 bg-white/80 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2"> Пример формата файла:</p>
            <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-x-auto font-mono">
{`спам
реклама
мат
плохое слово
ещё одно слово`}
            </pre>
          </div>
        </div>

        {/* Форма добавления одного слова */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-sm">➕</span>
            Добавить одно слово
          </h2>
          
          <form onSubmit={handleAddWord} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
              placeholder="Введите слово или фразу..."
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !newWord.trim()}
              className="gradient-btn text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? 'Добавление...' : 'Добавить'}
            </button>
          </form>
        </div>

        {/* Поиск и статистика */}
        {words.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color]"
                placeholder="Поиск по словам..."
              />
            </div>
            <p className="text-sm text-gray-600 whitespace-nowrap">
              Всего: <strong className="text-purple-700">{words.length}</strong>
              {searchQuery && <> | Найдено: <strong className="text-purple-700">{filteredWords.length}</strong></>}
            </p>
          </div>
        )}

        {/* Список слов */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-purple-100 rounded-xl"></div>)}
          </div>
        ) : paginatedWords.length > 0 ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 divide-y divide-purple-50 overflow-hidden">
              {paginatedWords.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-purple-50/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-base md:text-lg break-all">
                      {item.word}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Добавлено: {formatDate(item.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteWord(item.id)}
                    disabled={deletingId === item.id}
                    className="w-full sm:w-auto px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === item.id ? '⏳...' : '🗑️ Удалить'}
                  </button>
                </div>
              ))}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Предыдущая
                </button>
                <div className="text-gray-600 text-sm">Страница {currentPage} из {totalPages}</div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Следующая →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              {searchQuery ? 'Ничего не найдено' : 'Список пуст'}
            </h2>
            <p className="text-gray-600 text-sm">
              {searchQuery 
                ? 'Попробуйте изменить поисковый запрос' 
                : 'Нет запрещённых слов. Добавьте первое слово выше или загрузите файл.'}
            </p>
          </div>
        )}

        {/* Информация */}
        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <span className="text-lg">ℹ️</span> Как это работает:
          </p>
          <p className="text-sm text-purple-800 leading-relaxed">
            Когда пользователь пытается оставить комментарий или отзыв, система проверяет текст на наличие запрещённых слов. 
            Если найдено совпадение — публикация блокируется с сообщением об ошибке.
          </p>
        </div>

        {/* Модальное окно очистки */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-red-200">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Очистить весь список?</h2>
                <p className="text-sm text-gray-600">
                  Будут удалены все <strong className="text-red-600">{words.length}</strong> запрещённых слов. Это действие нельзя отменить.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
                >
                  Да, удалить всё
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}