'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { useToast, ToastProvider } from '@/components/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ListPlus, Sparkles, Trash2 } from 'lucide-react'
import { addTopic, deleteTopic } from './actions'

// План тем для ИИ-агента: автор пополняет список, агент берёт следующую тему
// через /api/agent/topics и публикует уроки через /api/agent/lessons.
// Чтение — на клиенте под RLS (видны только свои темы), запись — через
// server actions с проверкой сессии.

type TopicRow = {
  id: string
  title: string | null
  notes: string | null
  status: 'queued' | 'in_progress' | 'published' | 'skipped'
  lesson_id: string | null
  suggested_by: 'author' | 'agent'
  created_at: string
}

const STATUS: Record<TopicRow['status'], { label: string; variant: 'gray' | 'orange' | 'green' | 'blue' }> = {
  queued: { label: 'В очереди', variant: 'gray' },
  in_progress: { label: 'В работе', variant: 'orange' },
  published: { label: 'Опубликован', variant: 'green' },
  skipped: { label: 'Отложена', variant: 'blue' },
}

export default function TopicsPage() {
  return (
    <ToastProvider>
      <TopicsContent />
    </ToastProvider>
  )
}

function TopicsContent() {
  const toast = useToast()
  const supabase = createClient()

  const [topics, setTopics] = useState<TopicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      redirect('/login')
      return
    }
    const { data } = await supabase
      .from('lesson_topics')
      .select('id, title, notes, status, lesson_id, suggested_by, created_at')
      .order('created_at', { ascending: false })
    setTopics((data || []) as TopicRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await addTopic(title, notes)
    setSaving(false)
    if (!res.ok) {
      toast.showToast(res.error || 'Не удалось добавить тему', 'error')
      return
    }
    setTitle('')
    setNotes('')
    load()
    toast.showToast('Тема добавлена в план', 'success')
  }

  const handleDelete = async (id: string) => {
    setConfirmingId(null)
    const res = await deleteTopic(id)
    if (!res.ok) {
      toast.showToast(res.error || 'Не удалось удалить тему', 'error')
      return
    }
    toast.showToast('Тема удалена из плана', 'success')
    load()
  }

  const queuedCount = topics.filter(t => t.status === 'queued').length

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />
      <h1 className="text-3xl sm:text-4xl font-bold gradient-text mt-2 mb-2">План тем</h1>
      <p className="text-gray-600 mb-8">
        Список тем для вашего ИИ-агента: он берёт следующую тему из очереди и готовит по ней урок.
        {queuedCount > 0 && <> Сейчас в очереди: <span className="font-semibold text-purple-700">{queuedCount}</span>.</>}
      </p>

      {/* Как это работает */}
      <Card padding="md" className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" /> Как это работает
        </h2>
        <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>Заполненная тема — агент напишет урок строго по ней.</li>
          <li>
            <span className="font-medium text-gray-900">Пустая тема</span> — агент сам предложит тему
            (по вашим пожеланиям или по профилю) и впишет её сюда.
          </li>
          <li>Готовый урок появится в разделе «Создаю» вашего кабинета; статус темы сменится на «Опубликован».</li>
          <li>Отказаться от темы можно в любой момент — удалите её из плана.</li>
        </ul>
      </Card>

      {/* Форма добавления */}
      <Card padding="md" className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ListPlus className="w-4 h-4 text-purple-500" /> Новая тема
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              placeholder="Тема урока (можно оставить пустой — агент предложит сам)"
              className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color]"
            />
          </div>
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Пожелания — необязательно: для кого, какой тон, что раскрыть"
              className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-[box-shadow,border-color] resize-y"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Добавляю…' : 'Добавить в план'}
          </Button>
        </form>
      </Card>

      {/* Список тем */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-gray-500">Загрузка…</div>
        ) : topics.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-gray-500">
              План пуст. Добавьте первую тему — или оставьте поле темы пустым, чтобы агент предложил сам.
            </p>
          </Card>
        ) : (
          topics.map((topic) => {
            const status = STATUS[topic.status] || STATUS.queued
            const deletable = topic.status === 'queued' || topic.status === 'skipped'
            return (
              <Card key={topic.id} padding="sm" className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {topic.title || <span className="text-gray-400 italic">Тему предложит агент</span>}
                    </span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {topic.suggested_by === 'agent' && (
                      <Badge variant="purple">тема от агента</Badge>
                    )}
                  </div>
                  {topic.notes && (
                    <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{topic.notes}</p>
                  )}
                  {topic.status === 'published' && topic.lesson_id && (
                    <Link
                      href={`/lesson/${topic.lesson_id}`}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-1 inline-block transition-colors"
                    >
                      Открыть урок →
                    </Link>
                  )}
                </div>
                {deletable && (
                  confirmingId === topic.id ? (
                    <button
                      onClick={() => handleDelete(topic.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors flex-shrink-0"
                    >
                      Точно удалить?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(topic.id)}
                      aria-label="Удалить тему"
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </Card>
            )
          })
        )}
      </div>
    </main>
  )
}