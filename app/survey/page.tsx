import type { Metadata } from 'next'
import SurveyForm from './SurveyForm'

// Публичная страница опроса разведки (без авторизации). Ссылку раздаём в чат
// сообщества предпринимателей: https://coach-platform-pi.vercel.app/survey
// (алиас открывается из РФ; основной домен rightway.su — под SNI-фильтром).
// Спека: docs/specs/survey.md · Тексты вопросов: app/survey/questions.ts
export const metadata: Metadata = {
  title: 'Опрос: как компании обучают новичков',
  description:
    'Разведка перед новым проектом: как в реальных компаниях устроено знакомство новичков с работой и обучение персонала. 10 минут, анонимно.',
}

export default function SurveyPage() {
  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:pt-28 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Как компании обучают новичков?
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-500 dark:text-gray-400">
          Привет! Я изучаю, как компании знакомят новичков с работой и обучают
          персонал. Это разведка, не продажа — мне важно понять, как это
          устроено в реальном бизнесе. Займёт 7–10 минут, вопросы простые.
        </p>
      </header>

      <SurveyForm />

      <p className="mt-6 text-xs text-gray-400 text-center">
        Ответы пойдут только автору опроса, обобщим без имён.
      </p>
    </div>
  )
}