'use client'

import { useState, useTransition } from 'react'
import { updateAiPublishTime } from '@/app/actions/aiSettings'

// Настройка «Публиковать уроки в HH:MM» (карточка на /dashboard/ai).
// Агент создаёт уроки, когда запускается (например, ночью), а публикует
// в указанное время — через отложенную публикацию (publish_at + pg_cron).
// Пустое значение = настройка сброшена, агент публикует на своё усмотрение.

export function PublishTimeForm({ initialTime }: { initialTime: string | null }) {
  const [time, setTime] = useState(initialTime ?? '')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateAiPublishTime(time)
      if (result.ok) {
        setMessage({
          kind: 'ok',
          text: time.trim()
            ? `Сохранено: уроки будут выходить в ${time.trim()}`
            : 'Сохранено: время не задано, агент публикует на своё усмотрение',
        })
      } else {
        setMessage({ kind: 'error', text: result.error })
      }
    })
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Время публикации уроков"
          className="px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color] text-gray-900 bg-white"
        />
        <button
          onClick={save}
          disabled={pending}
          className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
      {message && (
        <p className={`text-sm mt-2 ${message.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}