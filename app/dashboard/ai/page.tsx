import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { KeyRound, ListChecks, ChevronRight, CalendarClock } from 'lucide-react'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import { PublishTimeForm } from './PublishTimeForm'

// Хаб раздела «Управление с ИИ»: всё, чем автор управляет ИИ-агентом, —
// в одном месте. Рабочие инструменты автора (уроки, курсы, профиль) остаются
// в кабинете; здесь только то, что нужно при подключённом агенте.

const TOOLS = [
  {
    href: '/dashboard/ai/topics',
    icon: ListChecks,
    title: 'План тем',
    description:
      'Очередь тем для агента: заполненная тема — урок строго по ней, пустая — агент предложит сам.',
  },
  {
    href: '/dashboard/ai/keys',
    icon: KeyRound,
    title: 'API-ключи агента',
    description:
      'Персональные ключи для ИИ-агента (например, Claude Code). Виден один раз, отзыв — мгновенно.',
  },
]

export default async function AiHubPage() {
  const supabase = await createClient()

  // Серверная проверка входа (страховка к proxy.ts, который уже редиректит анонима)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Текущее время публикации — для формы настройки (coaches.ai_publish_time)
  const { data: coach } = await supabase
    .from('coaches')
    .select('ai_publish_time')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      {/* Навигация по разделам кабинета (заменяет кнопку «Назад») */}
      <MentorSectionNav className="mb-6" />
      <h1 className="text-3xl sm:text-4xl font-bold gradient-text mt-2 mb-2">Управление с ИИ</h1>
      <p className="text-gray-600 mb-8">
        Всё, что нужно для работы вашего ИИ-агента: он пишет уроки по вашему плану тем
        и подключается к платформе по персональному ключу.
      </p>

      {/* Расписание публикации: агент пишет когда удобно, выходит урок в заданное время */}
      <Card padding="lg" className="mb-4 border border-purple-100">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-11 h-11 rounded-xl gradient-icon flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">Время публикации</h2>
            <p className="text-sm text-gray-600 mt-1">
              Агент создаёт уроки, когда запускается (например, ночью), а читатели
              видят их в указанное время. Пусто — агент публикует на своё усмотрение.
            </p>
          </div>
        </div>
        <PublishTimeForm initialTime={coach?.ai_publish_time ?? null} />
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {TOOLS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group">
            <Card padding="lg" className="h-full hover:shadow-lg transition-colors border border-purple-100 group-hover:border-purple-200">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl gradient-icon flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-1">
                    {title}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}