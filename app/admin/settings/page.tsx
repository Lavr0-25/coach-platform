'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({ autoBanThreshold: 3, autoBanDurationDays: 5 })

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('key, value').in('key', ['auto_ban_threshold', 'auto_ban_duration_days'])
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
      await Promise.all([
        supabase.from('system_settings').upsert({ key: 'auto_ban_threshold', value: settings.autoBanThreshold.toString() }),
        supabase.from('system_settings').upsert({ key: 'auto_ban_duration_days', value: settings.autoBanDurationDays.toString() }),
      ])
      alert('✅ Настройки сохранены!')
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 py-10 container mx-auto px-4 max-w-2xl animate-pulse"><div className="h-8 bg-purple-100 rounded w-1/3 mb-4"></div><div className="h-64 bg-purple-100 rounded-2xl"></div></div>

  return (
    <main className="min-h-screen bg-gray-50 py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">⚙️ Настройки системы</h1>
            <p className="text-gray-600 text-sm mt-1">Управление параметрами автоматической модерации</p>
          </div>
          <Link href="/admin" className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm">← Назад</Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 md:p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">🚫 Автоматическая блокировка</h2>
          <p className="text-sm text-gray-600 mb-6">При достижении указанного количества жалоб контент удаляется, а автор блокируется.</p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество жалоб для автобана</label>
              <input type="number" min="1" max="10" value={settings.autoBanThreshold} onChange={(e) => setSettings({ ...settings, autoBanThreshold: parseInt(e.target.value) || 3 })} className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Длительность блокировки (дней)</label>
              <input type="number" min="1" max="365" value={settings.autoBanDurationDays} onChange={(e) => setSettings({ ...settings, autoBanDurationDays: parseInt(e.target.value) || 5 })} className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all" />
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full gradient-btn text-white py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {saving ? 'Сохранение...' : '💾 Сохранить настройки'}
            </button>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-purple-900 mb-2">ℹ️ Как это работает:</p>
          <ul className="text-sm text-purple-800 space-y-2 list-disc list-inside">
            <li>При {settings.autoBanThreshold}+ жалобах на отзыв/комментарий контент удаляется</li>
            <li>Пользователь автоматически блокируется на {settings.autoBanDurationDays} дней</li>
            <li>Пользователь получает уведомление о блокировке</li>
          </ul>
        </div>
      </div>
    </main>
  )
}