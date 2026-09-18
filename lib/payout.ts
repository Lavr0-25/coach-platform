// Кошелёк ментора: общие константы и типы.
// Сюда вынесено то, что импортируют клиентские компоненты: модуль с 'use server'
// (app/actions/payout.ts) может экспортировать только асинхронные функции —
// константы и типы в нём запрещены (Turbopack отбрасывает весь модуль).

export type UnreceiptedPayout = {
  id: string
  amount: number
  processed_at: string | null // дата выплаты — она же в подсказке «приложите чек»
}

export type WalletSummary = {
  earnedTotal: number // всего начислено (completed-роялти)
  withdrawnTotal: number // выплачено по заявкам (paid)
  pendingTotal: number // в заявке на рассмотрении (pending)
  available: number // доступно к выводу
  hasPayoutDetails: boolean
  activeRequestId: string | null
  // Выплаченная заявка без чека «Мой налог»: пока её не закроет автор,
  // новые заявки на вывод заблокированы (2026-09-17).
  unreceiptedPayout: UnreceiptedPayout | null
}

// Минимальная сумма вывода (п. 6.5 оферты). Дубль CHECK amount >= 1000 в БД.
export const MIN_PAYOUT_RUB = 1000