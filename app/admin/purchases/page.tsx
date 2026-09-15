import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'

// Деньги в русской записи: 1000 → «1 000 ₽»
function money(n: number) {
  return `${n.toLocaleString('ru-RU')} ₽`
}

export default async function AdminPurchasesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coach?.role !== 'admin') redirect('/')

  // Все сущности одним набором запросов; связываем в JS — таблицы маленькие
  const [
    { data: purchases },
    { data: subPayments },
    { data: lessons },
    { data: courses },
    { data: coaches },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('purchases').select('id, lesson_id, course_id, amount, platform_commission, coach_earnings, payment_status, user_id, purchased_at').order('purchased_at', { ascending: false }),
    // Платные подписки на автора (Ф3): журнал списаний, автор = coach_user_id
    supabase.from('subscription_payments').select('id, amount, platform_commission, coach_earnings, status, period_months, user_id, coach_user_id, paid_at, created_at').order('paid_at', { ascending: false }),
    supabase.from('lessons').select('id, title, coach_id'),
    supabase.from('courses').select('id, title, coach_id'),
    supabase.from('coaches').select('id, user_id, display_name'),
    supabase.from('profiles').select('id, full_name'),
  ])

  const lessonById = new Map((lessons || []).map(l => [l.id, l]))
  const courseById = new Map((courses || []).map(c => [c.id, c]))
  const coachName = new Map(
    (coaches || []).map(c => {
      const p = (profiles || []).find(pr => pr.id === c.user_id)
      return [c.id, c.display_name || p?.full_name || 'Автор']
    })
  )
  // Для подписок: ключ — id профиля автора (coach_user_id), а не id в coaches
  const coachProfileName = new Map(
    (coaches || []).map(c => {
      const p = (profiles || []).find(pr => pr.id === c.user_id)
      return [c.user_id, c.display_name || p?.full_name || 'Автор']
    })
  )
  const buyerName = new Map((profiles || []).map(p => [p.id, p.full_name || 'Ученик']))

  const rows = [
    ...(purchases || []).map(p => {
      const lesson = p.lesson_id ? lessonById.get(p.lesson_id) : undefined
      const course = p.course_id ? courseById.get(p.course_id) : undefined
      return {
        id: p.id,
        buyer: buyerName.get(p.user_id) || 'Ученик',
        author: lesson ? coachName.get(lesson.coach_id) || 'Автор' : course ? coachName.get(course.coach_id) || 'Автор' : '—',
        material: lesson?.title || course?.title || '—',
        amount: Number(p.amount || 0),
        commission: Number(p.platform_commission || 0),
        earnings: Number(p.coach_earnings ?? p.amount ?? 0),
        status: p.payment_status,
        date: p.purchased_at,
      }
    }),
    // Списания подписок — той же строкой: автор определяется по coach_user_id
    ...(subPayments || []).map(sp => ({
      id: `sub-${sp.id}`,
      buyer: buyerName.get(sp.user_id) || 'Ученик',
      author: coachProfileName.get(sp.coach_user_id) || 'Автор',
      material: `Подписка на автора · ${sp.period_months} мес.`,
      amount: Number(sp.amount || 0),
      commission: Number(sp.platform_commission || 0),
      earnings: Number(sp.coach_earnings ?? sp.amount ?? 0),
      status: sp.status,
      date: sp.paid_at || sp.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // В деньгах считаем только completed — pending значит «оплата не дошла»
  const completed = rows.filter(r => r.status === 'completed')
  const turnover = completed.reduce((s, r) => s + r.amount, 0)
  const commission = completed.reduce((s, r) => s + r.commission, 0)
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const turnover30 = completed.filter(r => new Date(r.date) >= monthAgo).reduce((s, r) => s + r.amount, 0)

  const statusBadge = (status: string) =>
    status === 'completed' ? (
      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Оплачено</span>
    ) : status === 'pending' ? (
      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Ожидает</span>
    ) : (
      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{status}</span>
    )

  return (
    <main className="min-h-screen bg-gray-50 py-6 md:py-10">
      <div className="container mx-auto px-4 max-w-7xl pb-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0" />
            Продажи
          </h1>
          <p className="text-gray-600">
            Кто, что, когда и за сколько купил: оборот, комиссия платформы, выплаты авторам
          </p>
        </div>

        {/* Карточки */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="text-2xl font-bold text-purple-600">{money(turnover)}</div>
            <div className="text-sm text-gray-600">Оборот (оплачено)</div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="text-2xl font-bold text-emerald-600">{money(commission)}</div>
            <div className="text-sm text-gray-600">Комиссия платформы</div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{completed.length}</div>
            <div className="text-sm text-gray-600">Продаж всего</div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="text-2xl font-bold text-blue-600">{money(turnover30)}</div>
            <div className="text-sm text-gray-600">Оборот за 30 дней</div>
          </div>
        </div>

        {/* Таблица покупок */}
        {rows.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-700">
              <div className="col-span-2">Дата</div>
              <div className="col-span-2">Покупатель</div>
              <div className="col-span-2">Автор</div>
              <div className="col-span-3">Материал</div>
              <div className="col-span-1 text-center">Сумма</div>
              <div className="col-span-1 text-center">Статус</div>
              <div className="col-span-1 text-center">Автору</div>
            </div>
            <div className="divide-y divide-gray-50">
              {rows.map(r => (
                <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 px-6 py-4">
                  <div className="col-span-2 text-sm text-gray-500">
                    {new Date(r.date).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="col-span-2 font-semibold text-gray-900">{r.buyer}</div>
                  <div className="col-span-2 text-gray-700">{r.author}</div>
                  <div className="col-span-3 text-gray-700 truncate">{r.material}</div>
                  <div className="col-span-1 text-center font-semibold text-gray-700">
                    {money(r.amount)}
                    <span className="text-xs text-gray-400 md:hidden"> — сумма</span>
                  </div>
                  <div className="col-span-1 text-center">{statusBadge(r.status)}</div>
                  <div className="col-span-1 text-center font-bold text-emerald-600">
                    {money(r.earnings)}
                    <span className="text-xs text-gray-400 md:hidden"> — автору</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-gray-600">Покупок пока нет</p>
            <p className="text-sm text-gray-500 mt-1">
              Здесь появятся все покупки уроков и курсов на платформе
            </p>
          </div>
        )}
      </div>
    </main>
  )
}