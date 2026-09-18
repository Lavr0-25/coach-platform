'use client'

// Партнёрская программа ментора (Ф6.1): статус продаж + подключение по шагам.
// Пока продажи закрыты — инструкция, акцепт оферты, заявка с ИНН и сканом.
// Когда включены — карточка договора с файлами для скачивания.

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MentorSectionNav } from '@/components/MentorSectionNav'
import ShareButton from '@/components/ShareButton'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import {
  acceptOfferAgreement,
  submitPaidAccessRequest,
  savePayoutDetails,
  getAgreementFileUrl,
  getMyCommission,
} from '@/app/actions/partner'
import { getWalletSummary, requestPayout, attachReceipt } from '@/app/actions/payout'
import { MIN_PAYOUT_RUB } from '@/lib/payout'
import type { WalletSummary } from '@/lib/payout'
import {
  BadgeCheck,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Handshake,
  Lock,
  ReceiptText,
  RotateCcw,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'

type Agreement = {
  id: string
  offer_version: string
  contract_number: string | null
  status: 'active' | 'terminated'
  accepted_at: string
}

type AccessRequest = {
  id: string
  status: 'submitted' | 'approved' | 'returned'
  admin_comment: string | null
  created_at: string
}

type AgreementFile = {
  id: string
  kind: 'mentor_scan' | 'final_signed'
  original_name: string | null
  uploaded_at: string
}

export default function PartnerPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [paidAllowed, setPaidAllowed] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [request, setRequest] = useState<AccessRequest | null>(null)
  const [files, setFiles] = useState<AgreementFile[]>([])

  // Форма заявки
  const [accepted, setAccepted] = useState(false)
  const [inn, setInn] = useState('')
  const [comment, setComment] = useState('')
  const [scan, setScan] = useState<File | null>(null)
  const [facsimileRequested, setFacsimileRequested] = useState(false)

  // Реквизиты для выплат (появляются после одобрения заявки)
  const [payout, setPayout] = useState({ holder: '', account: '', bank: '', bik: '' })
  const [payoutSavedAt, setPayoutSavedAt] = useState<string | null>(null)
  const [payoutSaving, setPayoutSaving] = useState(false)

  // Кошелёк (2026-09-17): баланс + заявки на вывод
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [payoutRequests, setPayoutRequests] = useState<
    {
      id: string
      amount: number
      status: 'pending' | 'paid' | 'rejected'
      requested_at: string
      processed_at: string | null
      receipt_number: string | null
      admin_note: string | null
    }[]
  >([])
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  // Чек «Мой налог» (2026-09-17): автор прикладывает номер к своей выплате.
  // Пока чека нет — вывод заблокирован (см. wallet.unreceiptedPayout).
  const [receiptValue, setReceiptValue] = useState('')
  const [receiptBusy, setReceiptBusy] = useState(false)

  // Реферальная программа (№32): ссылка, число приведённых, активная скидка.
  const [refUserId, setRefUserId] = useState<string | null>(null)
  const [refCount, setRefCount] = useState(0)
  const [refDiscountPp, setRefDiscountPp] = useState(0)
  const [refUntil, setRefUntil] = useState<string | null>(null)
  const [refCopied, setRefCopied] = useState(false)
  // Текущая ставка комиссии (2026-09-17): итог с учётом скидок
  const [commission, setCommission] = useState<{ percent: number; base: 'manual' | 'global'; benefitPp: number } | null>(null)
  const accountDigits = payout.account.replace(/[\s-]/g, '')
  const isAccount = /^\d{20}$/.test(accountDigits) // счёт — БИК обязателен
  const payoutValid =
    payout.holder.trim().length >= 3 &&
    /^(\d{16,19}|\d{20})$/.test(accountDigits) &&
    payout.bank.trim().length >= 2 &&
    (/^\d{9}$/.test(payout.bik.trim()) || (!isAccount && !payout.bik.trim()))

  useEffect(() => {
    loadState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadState = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const [coachRes, agreementRes, payoutRes, refCountRes, refBenefitRes, payoutReqRes] = await Promise.all([
        supabase
          .from('coaches')
          .select('paid_publishing_allowed, display_name')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('mentor_agreements')
          .select('id, offer_version, contract_number, status, accepted_at')
          .eq('coach_user_id', user.id)
          .maybeSingle(),
        supabase
          .from('mentor_payout_details')
          .select('holder_name, account_no, bank_name, bik, updated_at')
          .eq('coach_user_id', user.id)
          .maybeSingle(),
        // Реферальная программа (№32): политика referrals_coach_select — свои записи
        supabase
          .from('referral_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('coach_user_id', user.id),
        // Активный бенефит: политика benefits_coach_select — свои записи
        supabase
          .from('commission_benefits')
          .select('discount_pp, expires_at')
          .eq('coach_user_id', user.id)
          .is('revoked_at', null)
          .or('expires_at.is.null,expires_at.gt.now()'),
        // Мои заявки на вывод (RLS payouts_coach_select — только свои)
        supabase
          .from('payout_requests')
          .select('id, amount, status, requested_at, processed_at, receipt_number, admin_note')
          .order('requested_at', { ascending: false })
          .limit(20),
      ])

      setPaidAllowed(!!(coachRes.data as any)?.paid_publishing_allowed)
      setDisplayName((coachRes.data as any)?.display_name || '')
      setRefUserId(user.id)
      setRefCount(refCountRes.count || 0)
      const myBenefits = (refBenefitRes.data as { discount_pp: number; expires_at: string | null }[]) || []
      setRefDiscountPp(myBenefits.reduce((s, b) => s + Number(b.discount_pp || 0), 0))
      const furthest = myBenefits
        .map(b => b.expires_at)
        .filter((d): d is string => !!d)
        .sort()
        .at(-1)
      setRefUntil(furthest || null)
      const agr = (agreementRes.data as Agreement) || null
      setAgreement(agr)
      if (payoutRes.data) {
        const p = payoutRes.data as any
        setPayout({
          holder: p.holder_name || '',
          account: p.account_no || '',
          bank: p.bank_name || '',
          bik: p.bik || '',
        })
        setPayoutSavedAt(p.updated_at || null)
      }
      setPayoutRequests((payoutReqRes.data as any[]) || [])

      // Текущая ставка: итоговый расчёт делает сервер (lib/commission.ts)
      const commissionRes = await getMyCommission()
      if (commissionRes.ok) setCommission(commissionRes.commission)

      // Кошелёк: баланс считает серверный экшен (completed-роялти минус заявки)
      const walletRes = await getWalletSummary()
      setWallet(walletRes.ok ? walletRes.wallet : null)

      if (agr) {
        const [reqRes, filesRes] = await Promise.all([
          supabase
            .from('paid_access_requests')
            .select('id, status, admin_comment, created_at')
            .eq('coach_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('mentor_agreement_files')
            .select('id, kind, original_name, uploaded_at')
            .eq('coach_user_id', user.id)
            .order('uploaded_at', { ascending: false }),
        ])
        setRequest((reqRes.data?.[0] as AccessRequest) || null)
        setFiles((filesRes.data as AgreementFile[]) || [])
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    setError('')
    setSaving(true)
    const res = await acceptOfferAgreement()
    setSaving(false)
    if (!res.ok) {
      setError(res.error || 'Ошибка')
      return
    }
    setSuccess('Условия приняты — теперь подайте заявку')
    await loadState()
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!/^\d{10}$|^\d{12}$/.test(inn.trim())) {
      setError('ИНН должен состоять из 10 или 12 цифр')
      return
    }

    setSaving(true)
    const fd = new FormData()
    fd.set('inn', inn.trim())
    fd.set('comment', comment)
    if (scan) fd.set('scan', scan)
    if (facsimileRequested) fd.set('facsimile_requested', 'on')
    const res = await submitPaidAccessRequest(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error || 'Ошибка')
      return
    }
    setSuccess('Заявка отправлена — ответ появится в этом разделе')
    setScan(null)
    await loadState()
  }

  const downloadFile = useCallback(async (fileId: string) => {
    setError('')
    const res = await getAgreementFileUrl(fileId)
    if (!res.ok) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener')
  }, [])

  const handleSavePayout = async () => {
    setError('')
    setSuccess('')
    setPayoutSaving(true)
    const fd = new FormData()
    fd.set('holder_name', payout.holder)
    fd.set('account_no', payout.account)
    fd.set('bank_name', payout.bank)
    fd.set('bik', payout.bik)
    const res = await savePayoutDetails(fd)
    setPayoutSaving(false)
    if (!res.ok) {
      setError(res.error || 'Ошибка')
      return
    }
    setSuccess('Реквизиты сохранены')
    await loadState()
  }

  const handleRequestPayout = async () => {
    setError('')
    setSuccess('')
    setWithdrawBusy(true)
    const res = await requestPayout(Number(withdrawAmount.replace(/[^\d.,]/g, '').replace(',', '.')))
    setWithdrawBusy(false)
    if (!res.ok) {
      setError(res.error || 'Ошибка')
      return
    }
    setSuccess('Заявка на вывод отправлена — решением сообщим в уведомлениях')
    setWithdrawOpen(false)
    setWithdrawAmount('')
    await loadState()
  }

  const handleAttachReceipt = async () => {
    setError('')
    setSuccess('')
    const payoutId = wallet?.unreceiptedPayout?.id
    if (!payoutId) return
    setReceiptBusy(true)
    const res = await attachReceipt(payoutId, receiptValue)
    setReceiptBusy(false)
    if (!res.ok) {
      setError(res.error || 'Ошибка')
      return
    }
    setSuccess('Чек приложен — заявки на вывод снова доступны')
    setReceiptValue('')
    await loadState()
  }

  const rub = (n: number) =>
    n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const requestBadge = (status: AccessRequest['status']) =>
    status === 'submitted' ? (
      <Badge variant="orange">На проверке</Badge>
    ) : status === 'approved' ? (
      <Badge variant="greenFill">Одобрена</Badge>
    ) : (
      <Badge variant="redFill">Возвращена</Badge>
    )

  if (loading) {
    return (
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
        <MentorSectionNav className="mb-6" />
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        </div>
      </main>
    )
  }

  const canSubmitRequest =
    agreement?.status === 'active' &&
    !paidAllowed &&
    (!request || request.status === 'returned')

  const showRequestForm =
    agreement?.status === 'active' &&
    !paidAllowed &&
    (!request || request.status === 'returned')

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl pt-24 sm:pt-28">
      <MentorSectionNav className="mb-6" />

      <div className="flex items-center gap-3 mb-1">
        <span className="gradient-icon w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0">
          <Handshake className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Партнёрская программа</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Продавайте свои уроки, курсы и подписку — подключение по шагам.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6">
          {success}
        </div>
      )}

      {/* Реферальная программа (№32, п. 5.4 оферты): ссылка + статус бенефита */}
      {refUserId && (
        <Card variant="glow" padding="none" className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 text-lg">Приглашайте учеников — ваша ставка комиссии снижается</div>
              <p className="text-sm text-gray-600 mt-1">
                Каждый новый пользователь, зарегистрировавшийся по вашей ссылке,
                продлевает срок действия вашей скидки на 1 месяц (п. 5.4 оферты).
                Размер скидки фиксированный — <strong>−5 п.п.</strong> к комиссии
                платформы; накапливается только срок, а не размер.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 break-all max-w-full">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?ref=${refUserId}` : ''}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}/?ref=${refUserId}`)
                      setRefCopied(true)
                      setTimeout(() => setRefCopied(false), 2000)
                    } catch {
                      /* clipboard недоступен — код виден рядом, можно выделить */
                    }
                  }}
                >
                  {refCopied ? <Check className="w-4 h-4" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
                  {refCopied ? 'Скопировано' : 'Скопировать'}
                </Button>
                {/* «Поделиться» реферальной ссылкой: системная шторка (мобильный)
                    или копирование (десктоп). Ссылка с utm_source=share; событие
                    share с целью 'profile' (targetId = свой профиль — реферальная
                    ссылка ведёт от лица этого пользователя). */}
                <ShareButton
                  path={`/?ref=${refUserId}`}
                  title="Верный путь — платформа менторов"
                  targetType="profile"
                  targetId={refUserId}
                  meta={{ kind: 'referral' }}
                />
              </div>
              <p className="text-sm text-gray-700 mt-3">
                Приведено пользователей: <strong>{refCount}</strong>
                {refDiscountPp > 0 ? (
                  <>
                    {' '}· действует скидка <strong>−{refDiscountPp} п.п.</strong> до{' '}
                    <strong>{new Date(refUntil!).toLocaleDateString('ru-RU')}</strong>
                  </>
                ) : (
                  ' · скидка пока не активна'
                )}
              </p>
              {/* Текущая ставка (2026-09-17): итог считал сервер с учётом
                  индивидуальной ставки платформы и активных скидок. */}
              {commission && (
                <p className="text-sm text-gray-700 mt-1">
                  Ваша ставка сейчас: комиссия платформы{' '}
                  <strong>{commission.percent.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%</strong>
                  {' '}— вам остаётся{' '}
                  <strong>
                    {(100 - commission.percent).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%
                  </strong>{' '}
                  от каждой продажи
                  {commission.benefitPp > 0 && <> (с учётом скидки −{commission.benefitPp} п.п.)</>}
                  {commission.base === 'manual' && commission.benefitPp === 0 && (
                    <> — ставка установлена платформой индивидуально</>
                  )}
                  .
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* СТАТУС: продажи включены */}
      {paidAllowed ? (
        <Card variant="glow" padding="none" className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
              <BadgeCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-lg">Продажи включены</div>
              <p className="text-sm text-gray-600 mt-1">
                Вы можете назначать цены урокам и курсам, а ученики — подписываться на вас.
                Ставка комиссии и ежемесячный отчёт — в этом разделе по мере появления продаж.
              </p>
            </div>
          </div>

          {/* Карточка договора */}
          {agreement && (
            <div className="mt-5 pt-5 border-t border-purple-100">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-gray-900 text-sm">Договор с платформой</span>
                {agreement.contract_number && (
                  <span className="text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5">
                    {agreement.contract_number}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Версия оферты {agreement.offer_version}, принят{' '}
                {new Date(agreement.accepted_at).toLocaleDateString('ru-RU')}
              </p>
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map(f => (
                    <button
                      key={f.id}
                      onClick={() => downloadFile(f.id)}
                      className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-800 font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      {f.kind === 'final_signed'
                        ? `Подписанный договор${f.original_name ? ` — ${f.original_name}` : ''}`
                        : `Ваш скан${f.original_name ? ` — ${f.original_name}` : ''}`}
                      <span className="text-gray-400 text-xs">
                        от {new Date(f.uploaded_at).toLocaleDateString('ru-RU')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Link
                href="/offer-mentor"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-700 transition-colors mt-3"
              >
                Текст договора-оферты <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* ШАГ 1: инструкция */}
          <Card variant="glow" padding="none" className="p-6 mb-6">
            <h2 className="font-semibold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-600" strokeWidth={1.5} />
              Как включить платные продажи
            </h2>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center mt-0.5">
                  1
                </span>
                <div>
                  Прочитайте{' '}
                  <Link
                    href="/offer-mentor"
                    className="text-purple-700 font-semibold underline underline-offset-2 hover:text-purple-800"
                  >
                    текст договора-оферты
                  </Link>{' '}
                  — это партнёрское соглашение: вы даёте платформе право продавать ваши
                  материалы, платформа платит вам роялти (вашу ставку видно в карточке
                  выше).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center mt-0.5 mt-0.5">
                  2
                </span>
                <div>
                  <b>Проверьте статус самозанятого</b> — в приложении «Мой налог»
                  (или убедитесь, что у вас статус ИП). Выплаты возможны только самозанятым и ИП:
                  на каждую выплату нужен чек (самозанятому — 6% с дохода от юрлица). Без статуса
                  заявку лучше не подавать.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center mt-0.5">
                  3
                </span>
                <div>
                  Примите условия ниже и подайте заявку с вашим ИНН. При желании приложите
                  подписанный вами скан договора — но это не обязательно: принятие условий кнопкой
                  на сайте имеет ту же силу.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center mt-0.5">
                  4
                </span>
                <div>
                  Администратор проверит заявку, подпишет договор и включит продажи. Статус появится здесь.
                </div>
              </li>
            </ol>
          </Card>

          {/* СТАТУС ЗАЯВКИ: на проверке / одобрена-ждёт-включения */}
          {request?.status === 'submitted' && (
            <Card variant="glow" padding="none" className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    Заявка отправлена {requestBadge(request.status)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Подана {new Date(request.created_at).toLocaleDateString('ru-RU')}.
                    Администратор проверит её и включит продажи — вы увидите статус в этом разделе.
                  </p>
                </div>
              </div>
            </Card>
          )}
          {request?.status === 'approved' && (
            <Card variant="glow" padding="none" className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    Заявка одобрена {requestBadge(request.status)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Администратор включит продажи при ближайшем обновлении вашего кабинета.
                    Если это затянулось — напомните через «Обратную связь».
                  </p>
                </div>
              </div>
            </Card>
          )}
          {request?.status === 'returned' && (
            <Card variant="glow" padding="none" className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    Заявка возвращена {requestBadge(request.status)}
                  </div>
                  {request.admin_comment && (
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line break-words">
                      Причина: {request.admin_comment}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Исправьте замечания и подайте заявку заново — форма ниже.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ШАГ: акцепт оферты (пока нет активного договора) */}
          {agreement?.status !== 'active' && (
            <Card variant="glow" padding="none" className="p-6 mb-6">
              <h2 className="font-semibold text-gray-900 text-lg mb-3">
                Шаг: принять условия
              </h2>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={e => setAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-purple-600 flex-shrink-0"
                />
                <span className="text-sm text-gray-700">
                  Я прочитал(а){' '}
                  <Link
                    href="/offer-mentor"
                    className="text-purple-700 font-semibold underline underline-offset-2 hover:text-purple-800"
                  >
                    договор-оферту
                  </Link>{' '}
                  и принимаю её условия: неисключительная лицензия на мои материалы,
                  роялти по ставке платформы (вашу ставку видно в карточке выше),
                  выплаты самозанятым и ИП по чеку.
                </span>
              </label>
              <div className="mt-4">
                <Button onClick={handleAccept} loading={saving} disabled={!accepted} size="lg">
                  Принять условия партнёрского соглашения
                </Button>
              </div>
            </Card>
          )}

          {/* ШАГ: заявка (договор активен, продажи ещё не включены) */}
          {showRequestForm && (
            <Card variant="glow" padding="none" className="p-6 mb-6">
              <h2 className="font-semibold text-gray-900 text-lg mb-3">
                Заявка на платные продажи
              </h2>
              <form onSubmit={handleSubmitRequest} className="space-y-5">
                <div>
                  <label htmlFor="inn" className="block text-sm font-semibold text-gray-700 mb-2">
                    ИНН *
                  </label>
                  <Input
                    id="inn"
                    type="text"
                    inputMode="numeric"
                    size="compact"
                    required
                    value={inn}
                    onChange={e => setInn(e.target.value.replace(/\D/g, ''))}
                    placeholder="10 или 12 цифр"
                    maxLength={12}
                    className="max-w-56"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Нужен для проверки статуса самозанятого (или ИП). Найти: приложение «Мой налог»
                    → профиль.
                  </p>
                  {/^\d{10}$|^\d{12}$/.test(inn.trim()) && (
                    <div className="mt-3">
                      <a
                        href={`/offer-mentor/print?inn=${inn.trim()}&name=${encodeURIComponent(displayName || '')}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-xl hover:bg-purple-50 transition-colors text-sm font-medium"
                      >
                        <FileText className="w-4 h-4" strokeWidth={1.5} />
                        Договор для подписи
                      </a>
                      <p className="text-xs text-gray-500 mt-1">
                        Откроется версия договора с вашими именем и ИНН — сохраните её в PDF
                        кнопкой на странице, распечатайте и подпишите. Скан приложите ниже;
                        не хотите бумагу — скан не нужен, достаточно заявки.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="facsimile" className="flex items-start gap-3 cursor-pointer">
                    <input
                      id="facsimile"
                      type="checkbox"
                      name="facsimile_requested"
                      checked={facsimileRequested}
                      onChange={(e) => setFacsimileRequested(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-purple-600 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700">
                      Проставить на договоре <b>факсимиле Платформы</b> (печать и подпись
                      ООО «Проинфо») — тогда в персональной версии будет уже «подписанный
                      платформой» документ: вам останется распечатать его, подписать своей
                      рукой и приложить скан выше.
                    </span>
                  </label>
                </div>

                <div>
                  <label htmlFor="comment" className="block text-sm font-semibold text-gray-700 mb-2">
                    Комментарий (необязательно)
                  </label>
                  <Textarea
                    id="comment"
                    rows={3}
                    size="compact"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Например: какой материал планируете продавать"
                  />
                </div>

                <div>
                  <label htmlFor="scan" className="block text-sm font-semibold text-gray-700 mb-2">
                    Подписанный вами скан договора (необязательно, PDF до 10 МБ)
                  </label>
                  <input
                    id="scan"
                    type="file"
                    accept="application/pdf"
                    onChange={e => setScan(e.target.files?.[0] || null)}
                    className="text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:font-semibold file:cursor-pointer hover:file:bg-purple-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Достаточно принятия условий кнопкой выше. Скан — если хотите классический
                    документ с вашей подписью: распечатайте оферту, подпишите, отсканируйте.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" loading={saving} size="lg">
                    Подать заявку
                  </Button>
                  <span className="text-sm text-gray-500">
                    Ответ появится в этом разделе
                  </span>
                </div>
              </form>
            </Card>
          )}

          {/* Заявки ещё не было и договор не принят — мягкая подсказка */}
          {!agreement && !request && (
            <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
              <Lock className="w-4 h-4" />
              Продажи выключены. Начните с шага 1 — текста договора.
            </div>
          )}
        </>
      )}

      {/* Кошелёк (2026-09-17): доступные средства и заявка на вывод.
          Условие показа — как у реквизитов: продажи включены или заявка
          одобрена (до этого роялти копиться не может). */}
      {(paidAllowed || request?.status === 'approved') && wallet && (
        <Card variant="glow" padding="none" className="p-6 mb-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-600" strokeWidth={1.5} />
            Средства
          </h2>

          <div className="text-2xl sm:text-3xl font-bold text-gray-900">
            Доступно: {rub(Math.max(0, wallet.available))} ₽
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Начислено всего: {rub(wallet.earnedTotal)} ₽
            {wallet.pendingTotal > 0 && <> · Ожидает выплаты: <strong>{rub(wallet.pendingTotal)} ₽</strong></>}
            {wallet.withdrawnTotal > 0 && <> · Выплачено: {rub(wallet.withdrawnTotal)} ₽</>}
          </p>

          {/* Чек «Мой налог»: выплата без чека блокирует новые заявки.
              Форма ввода номера — до кнопки вывода, чтобы причина блокировки
              была видна сразу. */}
          {wallet.unreceiptedPayout && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <ReceiptText className="w-4 h-4 flex-shrink-0" />
                Приложите чек к выплате от{' '}
                {wallet.unreceiptedPayout.processed_at
                  ? new Date(wallet.unreceiptedPayout.processed_at).toLocaleDateString('ru-RU')
                  : 'платформе'}
                {' '}на {rub(wallet.unreceiptedPayout.amount)} ₽
              </div>
              <p className="text-xs text-amber-800 mt-1">
                В приложении «Мой налог» найдите чек по этой выплате и введите его номер
                здесь. Пока чека нет, новые заявки на вывод недоступны (п. 4.2 договора).
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Input
                  type="text"
                  size="compact"
                  value={receiptValue}
                  onChange={e => setReceiptValue(e.target.value)}
                  placeholder="Номер чека «Мой налог»"
                  maxLength={50}
                  aria-label="Номер чека «Мой налог»"
                  className="max-w-64"
                />
                <Button size="sm" onClick={handleAttachReceipt} loading={receiptBusy} disabled={receiptValue.trim().length < 3}>
                  Приложить чек
                </Button>
              </div>
            </div>
          )}

          {/* Заявка на вывод: от 1 000 ₽ (п. 6.5 оферты), не больше доступного,
              реквизиты заполнены. Решение — только за администратором. */}
          {!withdrawOpen ? (
            <div className="mt-4">
              <Button
                onClick={() => { setWithdrawOpen(true); setWithdrawAmount(String(Math.floor(wallet.available))) }}
                disabled={wallet.activeRequestId !== null || wallet.available < MIN_PAYOUT_RUB || !!wallet.unreceiptedPayout}
              >
                {wallet.unreceiptedPayout
                  ? 'Сначала приложите чек'
                  : wallet.activeRequestId
                    ? 'Заявка на рассмотрении'
                    : 'Заявить вывод'}
              </Button>
              {/* Подсказка называет реальную причину блокировки, а не
                  «минимум» всегда: нет средств / не хватает до минимума /
                  заблокировано чеком. */}
              {wallet.unreceiptedPayout ? (
                <p className="text-xs text-amber-700 mt-2">
                  Вывод заблокирован: приложите чек «Мой налог» к выплате от{' '}
                  {wallet.unreceiptedPayout.processed_at
                    ? new Date(wallet.unreceiptedPayout.processed_at).toLocaleDateString('ru-RU')
                    : 'платформе'}
                  {' '}— жёлтая форма выше.
                </p>
              ) : wallet.activeRequestId ? (
                <p className="text-xs text-gray-500 mt-2">
                  Одновременно может быть только одна заявка на рассмотрении.
                </p>
              ) : wallet.available <= 0 ? (
                <p className="text-xs text-gray-500 mt-2">
                  Средств для вывода пока нет — роялти появится после первых продаж
                  и копится, не сгорая.
                </p>
              ) : wallet.available < MIN_PAYOUT_RUB ? (
                <p className="text-xs text-gray-500 mt-2">
                  Минимальная сумма вывода — {MIN_PAYOUT_RUB.toLocaleString('ru-RU')} ₽ (п. 6.5 договора):
                  накопите ещё {rub(MIN_PAYOUT_RUB - wallet.available)} ₽. Средства не сгорают.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 bg-purple-50 border border-purple-100 rounded-xl p-4 max-w-sm">
              <label htmlFor="withdraw-amount" className="block text-sm font-semibold text-gray-700 mb-2">
                Сумма вывода (от {MIN_PAYOUT_RUB.toLocaleString('ru-RU')} ₽, доступно {rub(wallet.available)} ₽)
              </label>
              <div className="flex gap-2">
                <Input
                  id="withdraw-amount"
                  type="text"
                  inputMode="decimal"
                  size="compact"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value.replace(/[^\d.,\s]/g, ''))}
                  placeholder="1000"
                  maxLength={12}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleRequestPayout} loading={withdrawBusy}>
                  Отправить заявку
                </Button>
                <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(false)} disabled={withdrawBusy}>
                  Отмена
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Выплата проводится в течение 10 рабочих дней после заявки (п. 6.5 оферты).
                Самозанятому: к выплате нужен чек из «Мой налог».
              </p>
            </div>
          )}

          {/* История заявок: статусы, чеки, причины отказов */}
          {payoutRequests.length > 0 && (
            <div className="mt-5 pt-5 border-t border-purple-100">
              <div className="font-semibold text-gray-900 text-sm mb-2">Мои заявки на вывод</div>
              <div className="space-y-2">
                {payoutRequests.map(r => (
                  <div key={r.id} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-gray-900">{rub(Number(r.amount))} ₽</strong>
                      {r.status === 'pending' && <Badge variant="orange">На рассмотрении</Badge>}
                      {r.status === 'paid' && (r.receipt_number
                        ? <Badge variant="greenFill">Выплачено</Badge>
                        : <Badge variant="orange">Ожидает чек</Badge>)}
                      {r.status === 'rejected' && <Badge variant="redFill">Отклонена</Badge>}
                      <span className="text-gray-500 text-xs">
                        от {new Date(r.requested_at).toLocaleDateString('ru-RU')}
                        {r.processed_at && ` · решение ${new Date(r.processed_at).toLocaleDateString('ru-RU')}`}
                      </span>
                    </div>
                    {r.status === 'paid' && r.receipt_number && (
                      <p className="text-xs text-gray-500 mt-1">Чек «Мой налог» № {r.receipt_number}</p>
                    )}
                    {r.status === 'rejected' && r.admin_note && (
                      <p className="text-xs text-gray-600 mt-1">Причина: {r.admin_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Реквизиты для выплат: после одобрения заявки (или при включённых
          продажах). Роялти копится с момента продажи и не сгорает — п. 6.2
          оферты; реквизиты нужны к первой выплате. */}
      {(paidAllowed || request?.status === 'approved') && (
        <Card variant="glow" padding="none" className="p-6 mb-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-600" strokeWidth={1.5} />
            Реквизиты для выплат
          </h2>

          {!payoutSavedAt ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-4">
              Вознаграждение копится с момента продажи и <b>не сгорает</b> — укажите реквизиты,
              чтобы получить выплату. Нужны к первой выплате (п. 6.2 договора).
            </div>
          ) : (
            <p className="text-xs text-gray-500 mb-4">
              Обновлены {new Date(payoutSavedAt).toLocaleDateString('ru-RU')}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="payout-holder" className="block text-sm font-semibold text-gray-700 mb-2">
                Получатель (ФИО) *
              </label>
              <Input
                id="payout-holder"
                type="text"
                size="compact"
                value={payout.holder}
                onChange={e => setPayout(p => ({ ...p, holder: e.target.value }))}
                placeholder="Иванова Мария Ивановна"
                maxLength={150}
              />
            </div>
            <div>
              <label htmlFor="payout-account" className="block text-sm font-semibold text-gray-700 mb-2">
                Карта или счёт *
              </label>
              <Input
                id="payout-account"
                type="text"
                inputMode="numeric"
                size="compact"
                value={payout.account}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 20)
                  // группы по 4 цифры — только для читаемости; в БД уходит без пробелов
                  const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ')
                  setPayout(p => ({ ...p, account: formatted }))
                }}
                placeholder="2200 1234 5678 9012"
                maxLength={24}
              />
            </div>
            <div>
              <label htmlFor="payout-bank" className="block text-sm font-semibold text-gray-700 mb-2">
                Банк *
              </label>
              <Input
                id="payout-bank"
                type="text"
                size="compact"
                value={payout.bank}
                onChange={e => setPayout(p => ({ ...p, bank: e.target.value }))}
                placeholder="Т-Банк"
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="payout-bik" className="block text-sm font-semibold text-gray-700 mb-2">
                БИК <span className="font-normal text-gray-400">{isAccount ? '*' : '(для карты не нужен)'}</span>
              </label>
              <Input
                id="payout-bik"
                type="text"
                inputMode="numeric"
                size="compact"
                value={payout.bik}
                onChange={e => setPayout(p => ({ ...p, bik: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                placeholder="9 цифр"
                maxLength={9}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Карта — 16–19 цифр, счёт — 20. Для счёта БИК обязателен (9 цифр), для карты не
            нужен. Самозанятому: на каждую выплату нужно будет прислать чек из «Мой налог»
            (п. 4.2 договора). Данные видите только вы и администратор платформы.
          </p>
          <div className="mt-4">
            <Button onClick={handleSavePayout} loading={payoutSaving} disabled={!payoutValid}>
              Сохранить реквизиты
            </Button>
          </div>
        </Card>
      )}
    </main>
  )
}