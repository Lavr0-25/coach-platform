import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import SurveyExportButton from './ExportButton'
import { SURVEY_QUESTIONS } from '@/app/survey/questions'

// Результаты опроса /survey. RSC-запрос через обычный серверный клиент:
// RLS отдаёт строки только админу (политика survey_admin_select), гвард
// /admin достаётся из app/admin/layout.tsx.

interface SurveyRow {
  id: string
  created_at: string
  answers: Record<string, unknown>
  ip_hash: string | null
  user_agent: string | null
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default async function AdminSurveyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (coach?.role !== 'admin') redirect('/')

  const { data: rows } = await supabase
    .from('survey_responses')
    .select('id, created_at, answers, ip_hash, user_agent')
    .order('created_at', { ascending: false })

  const responses = (rows ?? []) as SurveyRow[]
  const total = responses.length

  // Агрегаты по вариантам: для single/multi — count по каждому варианту,
  // для scale — распределение и среднее. Проценты считаем от числа ответивших.
  // Есть ли у строки осмысленный ответ на вопрос (не пустая строка/список/0)
  const hasAnswer = (r: SurveyRow, id: string) => {
    const a = r.answers[id]
    return (
      (typeof a === 'string' && a !== '') ||
      (Array.isArray(a) && a.length > 0) ||
      (typeof a === 'number' && a > 0)
    )
  }

  const optionCounts = (q: (typeof SURVEY_QUESTIONS)[number]) => {
    const counts = new Map<string, number>()
    for (const option of q.options ?? []) counts.set(option, 0)
    for (const r of responses) {
      const a = r.answers[q.id]
      if (q.kind === 'single' && typeof a === 'string' && counts.has(a)) {
        counts.set(a, (counts.get(a) ?? 0) + 1)
      }
      if (q.kind === 'multi' && Array.isArray(a)) {
        for (const v of a) if (counts.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1)
      }
    }
    return counts
  }

  const scaleDistribution = (id: string) => {
    const dist = [0, 0, 0, 0, 0]
    let sum = 0
    let n = 0
    for (const r of responses) {
      const a = r.answers[id]
      if (typeof a === 'number' && a >= 1 && a <= 5) {
        dist[a - 1]++
        sum += a
        n++
      }
    }
    return { dist, avg: n > 0 ? Math.round((sum / n) * 10) / 10 : 0, answered: n }
  }

  return (
    <main className="py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text flex items-center gap-3">
              <ClipboardList className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0" />
              Опрос «Как компании обучают новичков»
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Разведка B2B-LMS · публичная ссылка /survey · ответы: {total}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/admin"
              className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm"
            >
              ← Назад
            </Link>
            <SurveyExportButton rows={responses} disabled={total === 0} />
          </div>
        </div>

        {total === 0 ? (
          <div className="bg-white rounded-2xl border border-purple-100 p-8 text-center text-gray-500">
            Ответов пока нет. Ссылка для раздачи:{' '}
            <code className="text-purple-700">https://coach-platform-pi.vercel.app/survey</code>
          </div>
        ) : (
          <>
            {/* Вариантные вопросы: бары по вариантам */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {SURVEY_QUESTIONS.filter((q) => q.kind === 'single' || q.kind === 'multi').map((q) => {
                const counts = optionCounts(q)
                const answered = responses.filter((r) => {
                  const a = r.answers[q.id]
                  return typeof a === 'string' ? a !== '' : Array.isArray(a) && a.length > 0
                }).length
                return (
                  <div key={q.id} className="bg-white rounded-2xl border border-purple-100 p-5">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{q.title}</p>
                    <p className="text-xs text-gray-400 mb-4">Ответило: {answered} из {total}</p>
                    <div className="space-y-2">
                      {[...counts.entries()].map(([option, count]) => {
                        const percent = answered > 0 ? Math.round((count / answered) * 100) : 0
                        return (
                          <div key={option}>
                            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                              <span>{option}</span>
                              <span>
                                {count} · {percent}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-purple-500/80"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Шкала q7: распределение + среднее */}
            {(() => {
              const scale = SURVEY_QUESTIONS.find((q) => q.kind === 'scale')
              if (!scale) return null
              const { dist, avg, answered } = scaleDistribution(scale.id)
              return (
                <div className="bg-white rounded-2xl border border-purple-100 p-5 mb-6">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{scale.title}</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Среднее: <span className="font-bold text-purple-700">{avg}</span> из 5 · ответило {answered} из {total}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {dist.map((count, i) => {
                      const percent = answered > 0 ? Math.round((count / answered) * 100) : 0
                      return (
                        <div key={i} className="text-center">
                          <div className="text-xs text-gray-500 mb-1">{i + 1}</div>
                          <div className="h-16 rounded-lg bg-gray-100 flex items-end overflow-hidden">
                            <div
                              className="w-full bg-purple-500/80 rounded-lg"
                              style={{ height: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600 mt-1">{count}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Свободные ответы — по вопросам списком */}
            {SURVEY_QUESTIONS.filter((q) => q.kind === 'text').map((q) => {
              const texts = responses.filter((r) => typeof r.answers[q.id] === 'string' && r.answers[q.id] !== '')
              return (
                <div key={q.id} className="bg-white rounded-2xl border border-purple-100 p-5 mb-4">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{q.title}</p>
                  <p className="text-xs text-gray-400 mb-4">Ответило: {texts.length} из {total}</p>
                  {texts.length === 0 ? (
                    <p className="text-sm text-gray-400">Пока пусто.</p>
                  ) : (
                    <ul className="space-y-3">
                      {texts.map((r) => (
                        <li key={r.id} className="text-sm text-gray-700 border-l-2 border-purple-200 pl-3">
                          <p className="whitespace-pre-wrap break-words">{r.answers[q.id] as string}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDate(r.created_at)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}