'use client'

import { useState, useEffect, useCallback } from 'react'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { useToast, ToastProvider } from '@/components/Toast'
import {
  createAgentKey,
  listAgentKeys,
  revokeAgentKey,
  type AgentKeyInfo,
} from '@/app/actions/agentKeyActions'

const chip = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
}

export default function ApiKeysPage() {
  // Провайдер локальный: ToastProvider подключён в app/admin/layout, а эта страница
  // живёт вне админки — и не должна зависеть от админского доступа
  return (
    <ToastProvider>
      <ApiKeysContent />
    </ToastProvider>
  )
}

function ApiKeysContent() {
  const toast = useToast()
  const [keys, setKeys] = useState<AgentKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null) // показывается один раз
  const [copied, setCopied] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await listAgentKeys()
    if (!res.ok) {
      toast.showToast(res.error, 'error')
    } else {
      setKeys(res.keys)
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const res = await createAgentKey(name)
    setCreating(false)
    if (!res.ok) {
      toast.showToast(res.error, 'error')
      return
    }
    setNewKey(res.key)
    setCopied(false)
    setName('')
    load()
    toast.showToast('Ключ создан', 'success')
  }

  const handleCopy = async () => {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
  }

  const handleRevoke = async (id: string) => {
    setConfirmingId(null)
    const res = await revokeAgentKey(id)
    if (!res.ok) {
      toast.showToast(res.error, 'error')
      return
    }
    toast.showToast('Ключ отозван', 'success')
    load()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />
      <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mt-2 mb-2">
        API-ключи агента
      </h1>
      <p className="text-gray-600 mb-8">
        Персональный ключ, с которым ИИ-агент (например, Claude Code) работает с вашими данными
        из этой платформы. Ключ действует с правами вашей учётной записи и виден только один раз —
        сразу после создания.
      </p>

      {/* Инструкция */}
      <div className="bg-white border border-purple-100 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Что умеет агент с вашим ключом</h2>
        <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>
            <span className="font-medium text-gray-900">Первая версия — только чтение:</span> агент видит
            ваши обращения в поддержку (тексты, статусы, даты). Изменить или удалить что-либо,
            а также увидеть чужие данные он не может.
          </li>
          <li>
            <span className="font-medium text-gray-900">Новые функции появятся позже</span> — например,
            работа с вашим контентом и отчёты. Мы сообщим, когда они заработают; выданные ключи
            перевыпускать не потребуется.
          </li>
        </ul>
      </div>

      {/* Создание ключа */}
      <div className="bg-white border border-purple-100 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Новый ключ</h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название (например: Claude Code — ноутбук)"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            type="submit"
            disabled={creating}
            className="gradient-btn text-white px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
          >
            {creating ? 'Создаю…' : 'Создать ключ'}
          </button>
        </form>

        {newKey && (
          <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-sm font-semibold text-green-800 mb-2">
              Ключ создан. Скопируйте его сейчас — позже он не показывается:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-green-200 rounded-lg text-sm font-mono break-all">
                {newKey}
              </code>
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg border border-green-300 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors whitespace-nowrap"
              >
                {copied ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список ключей */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_180px_120px] gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Ключ</span>
          <span className="hidden sm:block">Создан</span>
          <span className="hidden sm:block">Использован</span>
          <span className="text-right">Действия</span>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">Загрузка…</div>
        ) : keys.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            Ключей пока нет — создайте первый выше.
          </div>
        ) : (
          <div className="divide-y divide-purple-50">
            {keys.map((k) => {
              const active = !k.revoked_at
              return (
                <div key={k.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_180px_120px] gap-4 px-6 py-4 items-center hover:bg-purple-50/30 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{k.name}</div>
                    <div className="sm:hidden text-xs text-gray-500">{formatDate(k.created_at)}</div>
                  </div>
                  <span className="hidden sm:block text-sm text-gray-600">{formatDate(k.created_at)}</span>
                  <span className="hidden sm:block text-sm text-gray-500">
                    {k.last_used_at ? formatDate(k.last_used_at) : '—'}
                  </span>
                  <div className="flex items-center gap-2 justify-end">
                    <span className={`${chip} ${
                      active ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-100 border-gray-200'
                    }`}>
                      {active ? 'Активен' : 'Отозван'}
                    </span>
                    {active && (
                      confirmingId === k.id ? (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          Точно отозвать?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(k.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          Отозвать
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-6 bg-white border border-purple-100 rounded-2xl p-6 text-sm text-gray-600">
        <p className="font-semibold text-gray-900 mb-2">Как пользоваться ключом</p>
        <p>
          Ключ передаётся в заголовке <code className="px-1.5 py-0.5 bg-gray-50 rounded text-xs">x-agent-key</code> к
          запросам <code className="px-1.5 py-0.5 bg-gray-50 rounded text-xs">/api/agent/*</code>. Ключ действует
          с правами вашей учётной записи: отзовите его — и доступ агента закроется сразу, без передеплоя.
        </p>
      </div>
    </div>
  )
}