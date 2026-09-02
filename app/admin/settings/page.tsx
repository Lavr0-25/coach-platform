'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    autoBanThreshold: 3,
    autoBanDurationDays: 5,
  })
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['auto_ban_threshold', 'auto_ban_duration_days'])

      if (error) throw error

      const threshold = data?.find(d => d.key === 'auto_ban_threshold')
      const duration = data?.find(d => d.key === 'auto_ban_duration_days')

      setSettings({
        autoBanThreshold: threshold ? parseInt(threshold.value) : 3,
        autoBanDurationDays: duration ? parseInt(duration.value) : 5,
      })
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccessMessage('')

    try {
      const updates = [
        supabase
          .from('system_settings')
          .upsert({
            key: 'auto_ban_threshold',
            value: settings.autoBanThreshold.toString(),
          }),
        supabase
          .from('system_settings')
          .upsert({
            key: 'auto_ban_duration_days',
            value: settings.autoBanDurationDays.toString(),
          }),
      ]

      const results = await Promise.all(updates)
      if (results.some(r => r.error)) throw results.find(r => r.error)?.error

      setSuccessMessage('✅ Настройки успешно сохранены!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="py-6 md:py-10">
        <div className="container mx-auto px-4 max-w-2xl animate-pulse space-y-4">
          <div className="h-8 bg-purple-100 rounded-xl w-1/3"></div>
          <div className="h-64 bg-purple-100 rounded-2xl"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">⚙️ Настройки системы</h1>
            <p className="text-gray-600 text-sm mt-1">Управление параметрами автоматической модерации</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm"
          >
            ← Назад
          </Link>
        </div>

        {/* Карточка настроек */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Автоматическая блокировка</h2>
              <p className="text-sm text-gray-600">Правила автоматической модерации контента</p>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Порог жалоб */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Количество жалоб для автобана
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.autoBanThreshold}
                onChange={(e) => setSettings({
                  ...settings,
                  autoBanThreshold: Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
                })}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color] bg-white"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Рекомендуемое значение: 3. При достижении этого лимита контент удаляется автоматически.
              </p>
            </div>

            {/* Длительность бана */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Длительность блокировки (дней)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.autoBanDurationDays}
                onChange={(e) => setSettings({
                  ...settings,
                  autoBanDurationDays: Math.max(1, Math.min(365, parseInt(e.target.value) || 1))
                })}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color,background-color,color] bg-white"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                На сколько дней пользователь теряет доступ к платформе.
              </p>
            </div>

            {/* Кнопка сохранения */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full gradient-btn text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Сохранить настройки
                </>
              )}
            </button>
          </div>
        </div>

        {/* Информационный блок */}
        <div className="bg-white border border-purple-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <span className="text-lg">ℹ️</span> Алгоритм работы автобана:
          </p>
          <ul className="text-sm text-purple-800 space-y-2.5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span>Когда пользователь получает <strong>{settings.autoBanThreshold}+</strong> жалоб на отзыв или комментарий.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span>Спорный контент <strong>автоматически удаляется</strong> из системы.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span>Пользователь блокируется на <strong>{settings.autoBanDurationDays} дней</strong> (не может войти в аккаунт).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span>Запись о блокировке автоматически добавляется в <Link href="/admin/stop-list" className="underline font-medium hover:text-purple-900">Стоп-лист</Link>.</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  )
}