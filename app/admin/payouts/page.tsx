'use client'

// Кошелёк — админская очередь заявок на вывод (2026-09-17, оферта п. 6.5).
// Выплата вручную с р/с ООО: админ переводит деньги, отмечает «Выплачено»
// с номером чека «Мой налог» либо отклоняет заявку с причиной (её увидит
// автор). Решения пишутся в audit_log (admin-payout.ts). Реквизиты автора
// показываются рядом с заявкой — бухгалтеру они и нужны для перевода.
// Кнопка «Выгрузить JSON» — реестр заявок для ежемесячного расчёта.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { processPayout, setReceiptNumber, getCoachAvailable } from '@/app/actions/admin-payout'
import {
  Banknote,
  Check,
  Download,
  ExternalLink,
  ReceiptText,
  Search,
  Wallet,
  XCircle,
} from 'lucide-react'

type PayoutStatus = 'pending' | 'paid' | 'rejected'

type PayoutRequest = {
  id: string
  coach_user_id: string
  amount: number
  status: PayoutStatus
  receipt_number: string | null
  admin_note: string | null
  requested_at: string
  processed_at: string | null
}

type PayoutDetails = {
  holder_name: string
  account_no: string
  bank_name: string
  bik: string | null
}

export default function AdminPayoutsPage() {
  const supabase = createClient()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [details, setDetails] = useState<Record<string, PayoutDetails>>({})
  const [available, setAvailable] = useState<Record<string, number>>({}) // coach_user_id → баланс

  const [busyId, setBusyId] = useState<string | null>(null)
  const [paidId, setPaidId] = useState<string | null>(null) // открытая форма «Выплачено»
  const [receipt, setReceipt] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null) // открытая форма отказа
  const [reason, setReason] = useState('')

  // Чек «Мой налог» (2026-09-17): на шаге «Выплачено» номер необязателен —
  // автор прикладывает сам в кабинете; до этого его вывод заблокирован.
  // Здесь — форма, чтобы вписать чек вручную (автор прислал в мессенджер).
  const [receiptFormId, setReceiptFormId] = useState<string | null>(null)
  const [receiptAdminValue, setReceiptAdminValue] = useState('')
  const [receiptSavingId, setReceiptSavingId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | PayoutStatus>('pending')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAll = async () => {
    const [reqRes, coachRes, detailsRes] = await Promise.all([
      supabase
        .from('payout_requests')
        .select('id, coach_user_id, amount, status, receipt_number, admin_note, requested_at, processed_at')
        .order('requested_at', { ascending: false })
        .limit(200),
      supabase.from('coaches').select('user_id, display_name'),
      supabase
        .from('mentor_payout_details')
        .select('coach_user_id, holder_name, account_no, bank_name, bik'),
    ])

    const rows = (reqRes.data as PayoutRequest[]) || []
    setRequests(rows)
    setNames(Object.fromEntries(((coachRes.data as any[]) || []).map(c => [c.user_id, c.display_name])))
    setDetails(Object.fromEntries(((detailsRes.data as any[]) || []).map(d => [d.coach_user_id, d])))

    // Баланс автора — для сверек; у каждой pending-заявки исключаем её саму
    // из резерва (иначе «доступно» всегда меньше суммы заявки)
    const pendingRows = rows.filter(r => r.status === 'pending')
    const availEntries = await Promise.all(
      pendingRows.map(async r => [r.coach_user_id, await getCoachAvailable(r.coach_user_id, r.id)] as const)
    )
    setAvailable(Object.fromEntries(availEntries))
    setLoading(false)
  }

  const rub = (n: number) =>
    n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const handlePaid = async (r: PayoutRequest) => {
    setBusyId(r.id)
    const res = await processPayout(r.id, 'paid', receipt, '')
    setBusyId(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', 'error')
      return
    }
    showToast(
      receipt.trim()
        ? `Отмечено «Выплачено»: ${rub(Number(r.amount))} ₽`
        : `Отмечено «Выплачено»: ${rub(Number(r.amount))} ₽. Автор должен приложить чек — до этого вывод заблокирован`
    )
    setPaidId(null)
    setReceipt('')
    await loadAll()
  }

  const handleReject = async (r: PayoutRequest) => {
    setBusyId(r.id)
    const res = await processPayout(r.id, 'rejected', '', reason)
    setBusyId(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', 'error')
      return
    }
    showToast('Заявка отклонена — автор получил причину')
    setRejectId(null)
    setReason('')
    await loadAll()
  }

  const handleSetReceipt = async (r: PayoutRequest) => {
    setReceiptSavingId(r.id)
    const res = await setReceiptNumber(r.id, receiptAdminValue)
    setReceiptSavingId(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', 'error')
      return
    }
    showToast('Чек приложен — вывод автору снова доступен')
    setReceiptFormId(null)
    setReceiptAdminValue('')
    await loadAll()
  }

  // Реестр заявок — JSON для бухгалтера. scope 'all' — весь реестр,
  // 'filtered' — с текущим фильтром и поиском (когда он вообще применён).
  const exportJson = (scope: 'all' | 'filtered') => {
    const rows = scope === 'all' ? requests : filtered
    const data = {
      exported_at: new Date().toISOString(),
      filter: scope === 'all' ? 'all' : statusFilter,
      search: scope === 'all' ? '' : query.trim(),
      requests: rows.map(r => ({
        id: r.id,
        author: names[r.coach_user_id] || r.coach_user_id,
        coach_user_id: r.coach_user_id,
        amount: Number(r.amount),
        status: r.status,
        requested_at: r.requested_at,
        processed_at: r.processed_at,
        receipt_number: r.receipt_number,
        admin_note: r.admin_note,
        payout_details: details[r.coach_user_id] || null,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `payouts-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const statusBadge = (s: PayoutStatus) =>
    s === 'pending' ? (
      <Badge variant="orange">Ожидает</Badge>
    ) : s === 'paid' ? (
      <Badge variant="greenFill">Выплачено</Badge>
    ) : (
      <Badge variant="redFill">Отклонено</Badge>
    )

  const counts: Record<'all' | PayoutStatus, number> = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    paid: requests.filter(r => r.status === 'paid').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }
  const pendingSum = requests
    .filter(r => r.status === 'pending')
    .reduce((s, r) => s + Number(r.amount), 0)

  // Поиск: автор, сумма, номер чека, причина (без регистра) — поверх фильтра
  const q = query.trim().toLowerCase()
  const filtered = requests
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      if (!q) return true
      const name = (names[r.coach_user_id] || '').toLowerCase()
      const receipt = (r.receipt_number || '').toLowerCase()
      const note = (r.admin_note || '').toLowerCase()
      return (
        name.includes(q) ||
        receipt.includes(q) ||
        note.includes(q) ||
        String(r.amount).includes(q) ||
        Number(r.amount).toLocaleString('ru-RU').includes(q)
      )
    })

  return (
    <main className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="gradient-icon w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0">
          <Wallet className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">Заявки на вывод</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Кошелёк авторов: роялти копится, вывод — от 1 000 ₽ по заявке (п. 6.5 оферты).
        Перевод делаете вручную с расчётного счёта, затем отмечаете результат. Все решения
        фиксируются в журнале действий.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-500">
          Заявок на вывод пока нет. Автор заявляет вывод в кабинете: «Партнёрская программа» → «Средства».
        </div>
      ) : (
        <>
          {/* Сводка + фильтр + выгрузка */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-gray-700">
                Ожидает выплат: <strong>{counts.pending}</strong> на сумму{' '}
                <strong>{rub(pendingSum)} ₽</strong>
                {statusFilter !== 'all' || query.trim() ? (
                  <span className="text-gray-400"> · отобрано: {filtered.length}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => exportJson('all')}>
                  <Download className="w-4 h-4" strokeWidth={1.5} />
                  Выгрузить всё (JSON)
                </Button>
                {(statusFilter !== 'all' || query.trim() !== '') && (
                  <Button size="sm" variant="ghost" onClick={() => exportJson('filtered')}>
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                    По фильтру
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск: автор, сумма, чек или причина…"
                className="pl-9"
                aria-label="Поиск по заявкам на вывод"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['pending', 'Ожидают'],
                  ['paid', 'Выплачено'],
                  ['rejected', 'Отклонено'],
                  ['all', 'Все'],
                ] as const
              ).map(([value, label]) => {
                const active = statusFilter === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                    }`}
                  >
                    {label}
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 ${
                        active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {counts[value]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-500">
              По этому фильтру заявок нет.
            </div>
          )}

          <div className="space-y-4">
            {filtered.map(r => {
              const d = details[r.coach_user_id]
              return (
                <div key={r.id} className="bg-white rounded-2xl shadow-sm border p-5">
                  {/* Шапка: автор + сумма + статус */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Banknote className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <Link
                      href={`/mentor/${r.coach_user_id}`}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-gray-900 hover:text-purple-700 transition-colors inline-flex items-center gap-1"
                      title="Открыть публичный профиль автора"
                    >
                      {names[r.coach_user_id] || 'Автор'}
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </Link>
                    <strong className="text-gray-900">{rub(Number(r.amount))} ₽</strong>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    заявка от {new Date(r.requested_at).toLocaleDateString('ru-RU')}
                    {r.processed_at && ` · решение ${new Date(r.processed_at).toLocaleDateString('ru-RU')}`}
                  </p>

                  {/* Реквизиты для перевода — то, что нужно бухгалтеру */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3">
                    <div className="font-semibold text-gray-900 text-xs uppercase tracking-wide mb-1">
                      Реквизиты для перевода
                    </div>
                    {d ? (
                      <>
                        <p className="text-gray-700">
                          {d.holder_name} · {d.bank_name}
                        </p>
                        <p className="font-mono text-gray-800 break-all">
                          {d.account_no.replace(/(\d{4})(?=\d)/g, '$1 ')}
                          {d.bik && <span className="font-sans text-gray-500"> · БИК {d.bik}</span>}
                        </p>
                      </>
                    ) : (
                      <p className="text-red-600">Реквизиты не заполнены — уточните у автора.</p>
                    )}
                  </div>

                  {/* Сверка с балансом (для ожидающих заявок) */}
                  {r.status === 'pending' && available[r.coach_user_id] !== undefined && (
                    <p className={`text-sm mb-3 ${
                      available[r.coach_user_id] >= Number(r.amount) ? 'text-gray-500' : 'text-red-600'
                    }`}>
                      Доступно у автора: <strong>{rub(available[r.coach_user_id])} ₽</strong>
                      {available[r.coach_user_id] < Number(r.amount) && ' — меньше суммы заявки!'}
                    </p>
                  )}

                  {r.status === 'paid' && r.receipt_number && (
                    <p className="text-sm text-gray-600 mb-3">Чек «Мой налог» № {r.receipt_number}</p>
                  )}
                  {r.status === 'rejected' && r.admin_note && (
                    <p className="text-sm text-red-700 mb-3">Причина отказа: {r.admin_note}</p>
                  )}

                  {/* Выплачено без чека: у автора вывод заблокирован, пока
                      чек не приложен. Можно вписать номер вручную. */}
                  {r.status === 'paid' && !r.receipt_number && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
                      <p className="text-sm text-amber-900 font-medium flex items-center gap-1.5">
                        <ReceiptText className="w-4 h-4 flex-shrink-0" />
                        Чек «Мой налог» не приложен — вывод автору заблокирован
                      </p>
                      {receiptFormId === r.id ? (
                        <div className="mt-2 space-y-2">
                          <Input
                            type="text"
                            size="compact"
                            value={receiptAdminValue}
                            onChange={e => setReceiptAdminValue(e.target.value)}
                            placeholder="Номер чека «Мой налог»"
                            maxLength={50}
                            aria-label={`Номер чека для заявки ${r.id}`}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              loading={receiptSavingId === r.id}
                              disabled={receiptAdminValue.trim().length < 3}
                              onClick={() => handleSetReceipt(r)}
                            >
                              Сохранить чек
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setReceiptFormId(null); setReceiptAdminValue('') }} disabled={receiptSavingId === r.id}>
                              Отмена
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => { setReceiptFormId(r.id); setReceiptAdminValue('') }}
                        >
                          Вписать чек вручную
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Действия: только у ожидающих */}
                  {r.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                      <Button size="sm" onClick={() => { setPaidId(r.id); setRejectId(null); setReceipt('') }}>
                        <Check className="w-4 h-4" strokeWidth={2} />
                        Отметить «Выплачено»
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRejectId(r.id); setPaidId(null); setReason('') }}>
                        <XCircle className="w-4 h-4" />
                        Отклонить
                      </Button>
                    </div>
                  )}
                  {r.status === 'pending' && paidId === r.id && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                      <label htmlFor={`receipt-${r.id}`} className="block text-sm font-semibold text-gray-700">
                        Номер чека «Мой налог» (необязательно)
                      </label>
                      <Input
                        id={`receipt-${r.id}`}
                        type="text"
                        size="compact"
                        value={receipt}
                        onChange={e => setReceipt(e.target.value)}
                        placeholder="Например: 1234567890123456"
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500">
                        Переведите сумму на реквизиты автора с р/с ООО. Чек обычно выпускает
                        самозанятый после получения денег: если номера ещё нет — оставьте поле
                        пустым, автор приложит его в кабинете (до этого вывод будет заблокирован).
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handlePaid(r)} loading={busyId === r.id}>
                          Подтвердить выплату
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPaidId(null)} disabled={busyId === r.id}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                  {r.status === 'pending' && rejectId === r.id && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                      <label htmlFor={`reason-${r.id}`} className="block text-sm font-semibold text-gray-700">
                        Причина отказа * (её увидит автор в кабинете)
                      </label>
                      <Textarea
                        id={`reason-${r.id}`}
                        rows={2}
                        size="compact"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Например: реквизиты не совпадают с данными договора"
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500">Средства остаются в кошельке автора.</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleReject(r)} loading={busyId === r.id} disabled={reason.trim().length < 5}>
                          Отклонить заявку
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejectId(null)} disabled={busyId === r.id}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}