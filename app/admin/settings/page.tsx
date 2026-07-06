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

      await Promise.all(updates)

      alert('✅ Настройки сохранены!')
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert('Ошибка: ' + (error.message || 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⚙️ Настройки системы</h1>
            <p className="text-gray-600 mt-1">
              Управление параметрами автоматической модерации
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            ← Назад
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🚫 Автоматическая блокировка
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            При достижении указанного количества жалоб на отзыв или комментарий, 
            контент автоматически удаляется, а автор блокируется.
          </p>

          <div className="space-y-6">
            {/* Порог жалоб */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Количество жалоб для автобана
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.autoBanThreshold}
                onChange={(e) => setSettings({
                  ...settings,
                  autoBanThreshold: parseInt(e.target.value) || 3
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Рекомендуемое значение: 3
              </p>
            </div>

            {/* Длительность бана */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Длительность блокировки (дней)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.autoBanDurationDays}
                onChange={(e) => setSettings({
                  ...settings,
                  autoBanDurationDays: parseInt(e.target.value) || 5
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                На сколько дней блокировать пользователя
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {saving ? 'Сохранение...' : '💾 Сохранить настройки'}
            </button>
          </div>
        </div>

        {/* Информация */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Как это работает:</strong>
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
            <li>Когда пользователь получает {settings.autoBanThreshold}+ жалобы на отзыв/комментарий</li>
            <li>Контент автоматически удаляется</li>
            <li>Пользователь блокируется на {settings.autoBanDurationDays} дней</li>
            <li>Пользователь получает уведомление о блокировке</li>
          </ul>
        </div>
      </div>
    </main>
  )
}