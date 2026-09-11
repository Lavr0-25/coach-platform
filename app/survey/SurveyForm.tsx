'use client'

// Форма опроса: один экран, вопросы карточками сверху вниз.
// Валидация обязательных — до отправки, с прокруткой к первому пропущенному.
// После успеха форма заменяется благодарностью (данные больше не нужны).

import { useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/Toast'
import { SURVEY_QUESTIONS, type SurveyQuestion } from './questions'
import { submitSurvey } from './actions'

type Answer = string | string[] | number

const CHECKBOX_BASE =
  'w-4.5 h-4.5 mt-0.5 shrink-0 rounded accent-purple-600 cursor-pointer'

export default function SurveyForm() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [missing, setMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const toast = useToast()
  const honeypotRef = useRef<HTMLInputElement>(null)

  const setAnswer = (id: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setMissing((prev) => prev.filter((x) => x !== id))
  }

  const toggleMulti = (id: string, option: string) => {
    const current = Array.isArray(answers[id]) ? (answers[id] as string[]) : []
    setAnswer(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  const isMissing = (q: SurveyQuestion, a: Answer | undefined): boolean => {
    if (!q.required) return false
    if (q.kind === 'multi') return !Array.isArray(a) || a.length === 0
    return a === undefined || a === '' || a === 0
  }

  const handleSubmit = async () => {
    // 1. Клиентская проверка обязательных — сервер потом перепроверит сам
    const unanswered = SURVEY_QUESTIONS.filter((q) => isMissing(q, answers[q.id]))
    if (unanswered.length > 0) {
      setMissing(unanswered.map((q) => q.id))
      document.getElementById(`q-${unanswered[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.showToast('Пожалуйста, ответьте на обязательные вопросы', 'error')
      return
    }

    // 2. Отправка (server action перепроверит всё и запишет в БД)
    setLoading(true)
    try {
      const result = await submitSurvey({ answers, honeypot: honeypotRef.current?.value })
      if (!result.ok) {
        toast.showToast(result.error, 'error')
        return
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('submitSurvey failed:', err)
      toast.showToast('Не удалось отправить ответы — попробуйте ещё раз', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-purple-600 mx-auto mb-4" strokeWidth={1.5} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Спасибо, ответы сохранены!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Это заняло меньше 10 минут — как и обещали. Обобщим результаты без имён.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* honeypot: визуально скрыт, для ботов, которые заполняют всё подряд */}
      <input
        ref={honeypotRef}
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {SURVEY_QUESTIONS.map((q) => {
        const value = answers[q.id]
        const hasError = missing.includes(q.id)
        return (
          <div key={q.id} id={`q-${q.id}`} className="scroll-mt-32">
          <Card className={`p-5 md:p-6 ${hasError ? 'border-red-300 border-2' : ''}`}>
            {/* Заголовок вопроса */}
            <div className="mb-4">
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {q.required && <span className="text-red-500">* </span>}
                {q.title}
              </p>
              {q.hint && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{q.hint}</p>
              )}
            </div>

            {/* Короткий/длинный текст */}
            {q.kind === 'text' && (
              <Textarea
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ваш ответ..."
                aria-required={q.required}
              />
            )}

            {/* Выбор одного */}
            {q.kind === 'single' && (
              <div className="space-y-2.5" role="radiogroup" aria-label={q.title}>
                {q.options?.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 -mx-3 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors has-[:checked]:border-purple-200 has-[:checked]:bg-purple-50 dark:has-[:checked]:bg-purple-900/20"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={option}
                      checked={value === option}
                      onChange={() => setAnswer(q.id, option)}
                      className="w-4.5 h-4.5 shrink-0 accent-purple-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Выбор нескольких */}
            {q.kind === 'multi' && (
              <div className="space-y-2.5">
                {q.options?.map((option) => {
                  const list = Array.isArray(value) ? (value as string[]) : []
                  return (
                    <label
                      key={option}
                      className="flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 -mx-3 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors has-[:checked]:border-purple-200 has-[:checked]:bg-purple-50 dark:has-[:checked]:bg-purple-900/20"
                    >
                      <input
                        type="checkbox"
                        checked={list.includes(option)}
                        onChange={() => toggleMulti(q.id, option)}
                        className={CHECKBOX_BASE}
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">{option}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Шкала 1–5 */}
            {q.kind === 'scale' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label
                      key={n}
                      className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 cursor-pointer transition-colors ${
                        value === n
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-transparent hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={value === n}
                        onChange={() => setAnswer(q.id, n)}
                        className="sr-only"
                      />
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-200">{n}</span>
                    </label>
                  ))}
                </div>
                {q.scaleLabels && (
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{q.scaleLabels[0]}</span>
                    <span>{q.scaleLabels[1]}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
          </div>
        )
      })}

      <Button size="lg" fullWidth loading={loading} onClick={handleSubmit}>
        Отправить ответы
      </Button>
    </div>
  )
}