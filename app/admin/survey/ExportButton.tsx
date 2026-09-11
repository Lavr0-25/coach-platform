'use client'

// Кнопка JSON-выгрузки ответов опроса (правило feedback-json-export-pattern):
// один файл со всеми полями строк, включая ip_hash/user_agent (только админ).
// Имена вопросов — из questions.ts, чтобы в выгрузке был человекочитаемый вид.

import { SURVEY_QUESTIONS } from '@/app/survey/questions'

interface SurveyRow {
  id: string
  created_at: string
  answers: Record<string, unknown>
  ip_hash: string | null
  user_agent: string | null
}

export default function SurveyExportButton({
  rows,
  disabled = false,
}: {
  rows: SurveyRow[]
  disabled?: boolean
}) {
  const download = () => {
    const data = {
      exported_at: new Date().toISOString(),
      source: 'rightway.su — опрос «Как компании обучают новичков»',
      total: rows.length,
      questions: SURVEY_QUESTIONS.map((q) => ({ id: q.id, title: q.title, kind: q.kind })),
      items: rows.map((r) => ({
        ...r,
        answers_titled: Object.fromEntries(
          SURVEY_QUESTIONS.map((q) => [q.title, r.answers[q.id] ?? null])
        ),
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `survey_${new Date().toISOString().split('T')[0]}.json`
    link.click()
  }

  return (
    <button
      onClick={download}
      disabled={disabled}
      className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Выгрузить JSON
    </button>
  )
}