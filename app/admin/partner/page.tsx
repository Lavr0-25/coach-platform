'use client'

// Ф6.2 спеки payments.md — админский раздел «Заявки на платный контент»:
// список заявок авторов, скан договора, одобрение (номер ЛД-ГГГГ-NNN),
// возврат с причиной, загрузка финального подписанного PDF, рубильник
// платных продаж. Решения логируются в audit_log (см. admin-partner.ts).

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import {
  approvePaidAccessRequest,
  returnPaidAccessRequest,
  setPaidPublishingAllowed,
  setCoachCommissionRate,
  uploadFinalSignedFile,
  getAdminAgreementFileUrl,
  uploadFacsimile,
  removeFacsimile,
} from '@/app/actions/admin-partner'
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Handshake,
  Percent,
  RotateCcw,
  Search,
  Stamp,
  Trash2,
  Upload,
  Wallet,
  XCircle,
} from 'lucide-react'

type Status = 'submitted' | 'approved' | 'returned'

type Request = {
  id: string
  coach_user_id: string
  inn: string
  mentor_comment: string | null
  status: Status
  admin_comment: string | null
  created_at: string
  decided_at: string | null
}

type CoachInfo = {
  display_name: string | null
  paid_publishing_allowed: boolean | null
  commission_rate: number | null
}

type FileInfo = {
  id: string
  coach_user_id: string
  kind: 'mentor_scan' | 'final_signed'
  original_name: string | null
  uploaded_at: string
}

export default function AdminPartnerPage() {
  const supabase = createClient()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<Request[]>([])
  const [coaches, setCoaches] = useState<Record<string, CoachInfo>>({})
  const [contracts, setContracts] = useState<Record<string, string | null>>({}) // coach_user_id → номер договора
  const [files, setFiles] = useState<FileInfo[]>([])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [returnId, setReturnId] = useState<string | null>(null) // открытая форма возврата
  const [returnReason, setReturnReason] = useState('')
  const [offId, setOffId] = useState<string | null>(null) // открытая форма отключения продаж
  const [offReason, setOffReason] = useState('')
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [facsimileUrl, setFacsimileUrl] = useState<string | null>(null)
  const [facsimileBusy, setFacsimileBusy] = useState(false)

  // Индивидуальная ставка (№33): id автора, чью ставку редактируем, + значение поля.
  // Пустое поле = снять ставку (вернуться к глобальной).
  const [rateEditId, setRateEditId] = useState<string | null>(null)
  const [rateValue, setRateValue] = useState('')
  const [rateSaving, setRateSaving] = useState(false)

  // Поиск + фильтр по статусу (клиентские: все заявки уже загружены)
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAll = async () => {
    const [reqRes, coachRes, agrRes, filesRes, facRes] = await Promise.all([
      supabase
        .from('paid_access_requests')
        .select('id, coach_user_id, inn, mentor_comment, status, admin_comment, created_at, decided_at')
        .order('created_at', { ascending: false }),
      supabase.from('coaches').select('user_id, display_name, paid_publishing_allowed, commission_rate'),
      supabase.from('mentor_agreements').select('coach_user_id, contract_number, status'),
      supabase
        .from('mentor_agreement_files')
        .select('id, coach_user_id, kind, original_name, uploaded_at')
        .order('uploaded_at', { ascending: false }),
      supabase.from('system_settings').select('value, updated_at').eq('key', 'facsimile_url').maybeSingle(),
    ])

    setRequests((reqRes.data as Request[]) || [])
    const coachMap: Record<string, CoachInfo> = {}
    ;((coachRes.data as any[]) || []).forEach(c => {
      coachMap[c.user_id] = {
        display_name: c.display_name,
        paid_publishing_allowed: c.paid_publishing_allowed,
        commission_rate: c.commission_rate,
      }
    })
    setCoaches(coachMap)
    const agrMap: Record<string, string | null> = {}
    ;((agrRes.data as any[]) || []).forEach(a => {
      agrMap[a.coach_user_id] = a.contract_number
    })
    setContracts(agrMap)
    setFiles((filesRes.data as FileInfo[]) || [])
    const facRow = (facRes.data as { value?: unknown; updated_at?: string } | null) || null
    const facValue = typeof facRow?.value === 'string' && facRow.value ? facRow.value : null
    setFacsimileUrl(facValue ? `${facValue}?v=${facRow?.updated_at || ''}` : null)
    setLoading(false)
  }

  const downloadFile = useCallback(async (fileId: string) => {
    const res = await getAdminAgreementFileUrl(fileId)
    if (!res.ok) {
      showToast(res.error, "error")
      return
    }
    window.open(res.url, '_blank', 'noopener')
  }, [showToast])

  // Сохранить индивидуальную ставку автора (№33). Пустое поле — снять ставку.
  const handleSaveRate = async (coachUserId: string) => {
    const trimmed = rateValue.trim().replace(',', '.')
    const percent = trimmed === '' ? null : Number(trimmed)
    setRateSaving(true)
    const res = await setCoachCommissionRate(coachUserId, percent)
    setRateSaving(false)
    if (!res.ok) {
      showToast(res.error || 'Не удалось сохранить ставку', 'error')
      return
    }
    setRateEditId(null)
    showToast(percent === null ? 'Индивидуальная ставка снята' : `Ставка ${percent}% сохранена`, 'success')
    loadAll()
  }

  const handleApprove = async (r: Request) => {
    if (!confirm(`Одобрить заявку и присвоить номер договора?`)) return
    setBusyId(r.id)
    const res = await approvePaidAccessRequest(r.id)
    setBusyId(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', "error")
      return
    }
    showToast('Заявка одобрена, договор получил номер')
    await loadAll()
  }

  const handleReturn = async (r: Request) => {
    setBusyId(r.id)
    const res = await returnPaidAccessRequest(r.id, returnReason)
    setBusyId(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', "error")
      return
    }
    showToast('Заявка возвращена автору')
    setReturnId(null)
    setReturnReason('')
    await loadAll()
  }

  const handleToggleSales = async (r: Request, allow: boolean) => {
    const reason = allow ? undefined : offReason
    setBusyId(r.id)
    const res = await setPaidPublishingAllowed(r.coach_user_id, allow, reason)
    setBusyId(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', "error")
      return
    }
    showToast(allow ? 'Продажи включены' : 'Продажи отключены')
    setOffId(null)
    setOffReason('')
    await loadAll()
  }

  const handleUploadFinal = async (r: Request, file: File) => {
    setUploadingFor(r.id)
    const fd = new FormData()
    fd.set('request_id', r.id)
    fd.set('file', file)
    const res = await uploadFinalSignedFile(fd)
    setUploadingFor(null)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', "error")
      return
    }
    showToast('Подписанный договор прикреплён — автор увидит его в кабинете')
    await loadAll()
  }

  // Ф6.3: факсимиле Платформы — загрузка/замена/удаление картинки.
  // Ключа facsimile_url в system_settings нет = факсимиле выключено.
  const handleUploadFacsimile = async (file: File) => {
    setFacsimileBusy(true)
    const fd = new FormData()
    fd.set('file', file)
    const res = await uploadFacsimile(fd)
    setFacsimileBusy(false)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', "error")
      return
    }
    showToast('Факсимиле загружено — появится в договорах авторов, которые его запросили')
    await loadAll()
  }

  const handleRemoveFacsimile = async () => {
    if (!confirm('Убрать факсимиле? Оно исчезнет из персональных версий договоров.')) return
    setFacsimileBusy(true)
    const res = await removeFacsimile()
    setFacsimileBusy(false)
    if (!res.ok) {
      showToast(res.error || 'Ошибка', "error")
      return
    }
    showToast('Факсимиле убрано')
    await loadAll()
  }

  const statusBadge = (s: Status) =>
    s === 'submitted' ? (
      <Badge variant="orange">На проверке</Badge>
    ) : s === 'approved' ? (
      <Badge variant="greenFill">Одобрена</Badge>
    ) : (
      <Badge variant="redFill">Возвращена</Badge>
    )

  const sorted = [...requests].sort((a, b) => {
    const order: Record<Status, number> = { submitted: 0, approved: 1, returned: 2 }
    return order[a.status] - order[b.status]
  })

  // Счётчики по статусам — для кнопок фильтра
  const statusCounts: Record<'all' | Status, number> = {
    all: requests.length,
    submitted: requests.filter(r => r.status === 'submitted').length,
    approved: requests.filter(r => r.status === 'approved').length,
    returned: requests.filter(r => r.status === 'returned').length,
  }

  // Поиск: автор, ИНН, номер договора (без регистра)
  const q = query.trim().toLowerCase()
  const filtered = sorted.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (!q) return true
    const name = (coaches[r.coach_user_id]?.display_name || '').toLowerCase()
    const contract = (contracts[r.coach_user_id] || '').toLowerCase()
    return r.inn.includes(q) || name.includes(q) || contract.includes(q)
  })

  return (
    <main className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="gradient-icon w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0">
          <Handshake className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">Заявки на платный контент</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Одобрение авторов для платных продаж: договор, финальная подписанная версия, рубильник продаж.
        Все решения фиксируются в журнале действий.
      </p>

      {/* Ф6.3: факсимиле Платформы — картинка для персональных договоров */}
      <div className="bg-white rounded-2xl shadow-sm border p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Stamp className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <h2 className="font-semibold text-gray-900">Факсимиле Платформы</h2>
          {facsimileUrl && <Badge variant="greenFill">Включено</Badge>}
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Печать и подпись ООО «Проинфо» для персональных версий договора — у авторов,
          которые попросили факсимиле галочкой в заявке (п. 10.5 договора). PNG или JPEG, до 2 МБ.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {facsimileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={facsimileUrl}
              alt="Факсимиле Платформы"
              className="h-20 w-auto max-w-[200px] object-contain border border-gray-200 rounded-xl bg-white p-1"
            />
          ) : (
            <div className="h-20 w-40 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
              не загружено
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                disabled={facsimileBusy}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleUploadFacsimile(f)
                  e.target.value = ''
                }}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-xl hover:bg-purple-50 transition-colors text-sm font-medium cursor-pointer">
                <Upload className="w-4 h-4" strokeWidth={1.5} />
                {facsimileBusy ? 'Загрузка…' : facsimileUrl ? 'Заменить' : 'Загрузить факсимиле'}
              </span>
            </label>
            {facsimileUrl && (
              <Button size="sm" variant="ghost" onClick={handleRemoveFacsimile} loading={facsimileBusy}>
                <Trash2 className="w-4 h-4" />
                Убрать
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-500">
          Заявок пока нет. Автор подаёт заявку в кабинете: «Партнёрская программа».
        </div>
      ) : (
        <>
          {/* Поиск + фильтр по статусу */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск: автор, ИНН или номер договора…"
                className="pl-9"
                aria-label="Поиск по заявкам"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'Все'],
                  ['submitted', 'На проверке'],
                  ['approved', 'Одобрена'],
                  ['returned', 'Возвращена'],
                ] as const
              ).map(([value, label]) => {
                const active = statusFilter === value
                const count = statusCounts[value]
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
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-500">
              Ничего не найдено по заданным условиям.
            </div>
          )}

          <div className="space-y-4">
          {filtered.map(r => {
            const coach = coaches[r.coach_user_id]
            const contractNumber = contracts[r.coach_user_id]
            const myFiles = files.filter(f => f.coach_user_id === r.coach_user_id)
            const salesOn = !!coach?.paid_publishing_allowed
            return (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm border p-5">
                {/* Шапка: кто + статус */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <Link
                    href={`/mentor/${r.coach_user_id}`}
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-gray-900 hover:text-purple-700 transition-colors inline-flex items-center gap-1"
                    title="Открыть публичный профиль автора"
                  >
                    {coach?.display_name || 'Автор'}
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </Link>
                  {statusBadge(r.status)}
                  {salesOn && (
                    <Badge variant="greenFill">
                      <Wallet className="w-3 h-3 inline mr-1" />
                      Продажи включены
                    </Badge>
                  )}
                  {contractNumber && (
                    <span className="text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5">
                      {contractNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  ИНН {r.inn} · подана {new Date(r.created_at).toLocaleDateString('ru-RU')}
                  {r.decided_at && ` · решение ${new Date(r.decided_at).toLocaleDateString('ru-RU')}`}
                </p>
                {/* Индивидуальная ставка комиссии (№33, п. 5.3 оферты) — для действующих авторов */}
                {r.status === 'approved' && (
                  <div className="mb-3">
                    {rateEditId === r.coach_user_id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          size="compact"
                          value={rateValue}
                          onChange={e => setRateValue(e.target.value)}
                          placeholder="комиссия, % (пусто = снять)"
                          className="max-w-56"
                        />
                        <Button size="sm" onClick={() => handleSaveRate(r.coach_user_id)} loading={rateSaving}>
                          Сохранить
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRateEditId(null)}>
                          Отмена
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <Percent className="w-4 h-4 text-purple-600" />
                        <span className="text-gray-700">
                          {coach?.commission_rate != null ? (
                            <>
                              Комиссия платформы: <strong>{coach.commission_rate}%</strong> (индивидуальная)
                            </>
                          ) : (
                            'Комиссия платформы: стандартная'
                          )}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRateEditId(r.coach_user_id)
                            setRateValue(coach?.commission_rate != null ? String(coach.commission_rate) : '')
                          }}
                        >
                          Изменить
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {/* Явно показываем, что автор указал (и что не указал) */}
                <p className="text-sm text-gray-700 mb-2 whitespace-pre-line break-words">
                  Комментарий автора: {r.mentor_comment || <span className="text-gray-400">—</span>}
                </p>
                {r.status === 'returned' && r.admin_comment && (
                  <p className="text-sm text-red-700 mb-2 whitespace-pre-line break-words">
                    Причина возврата: {r.admin_comment}
                  </p>
                )}

                {/* Файлы: скан автора + финальная подписанная версия */}
                {myFiles.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {myFiles.map(f => (
                      <button
                        key={f.id}
                        onClick={() => downloadFile(f.id)}
                        className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-800 font-medium transition-colors mr-4"
                      >
                        <Download className="w-4 h-4" />
                        {f.kind === 'final_signed' ? 'Финальный подписанный' : 'Скан автора'}
                        {f.original_name && <span className="text-gray-400 text-xs">{f.original_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {myFiles.length === 0 && (
                  <p className="text-sm text-gray-400 mb-3">
                    Скан договора не приложен — автор принимал условия кнопкой в кабинете
                    (это равнозначно подписи, п. 1.4 договора).
                  </p>
                )}

                {/* Действия: на проверке */}
                {r.status === 'submitted' && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                    <Button size="sm" onClick={() => handleApprove(r)} loading={busyId === r.id}>
                      <Check className="w-4 h-4" strokeWidth={2} />
                      Одобрить
                    </Button>
                    {returnId === r.id ? (
                      <div className="w-full space-y-2">
                        <Textarea
                          rows={2}
                          size="sm"
                          value={returnReason}
                          onChange={e => setReturnReason(e.target.value)}
                          placeholder="Причина возврата — её увидит автор в кабинете (от 5 символов)"
                          maxLength={1000}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReturn(r)}
                            loading={busyId === r.id}
                            disabled={returnReason.trim().length < 5}
                          >
                            <RotateCcw className="w-4 h-4" />
                            Вернуть заявку
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setReturnId(null); setReturnReason('') }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setReturnId(r.id); setOffId(null) }}>
                        <XCircle className="w-4 h-4" />
                        Вернуть
                      </Button>
                    )}
                  </div>
                )}

                {/* Действия: одобрена */}
                {r.status === 'approved' && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={uploadingFor === r.id}
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleUploadFinal(r, f)
                            e.target.value = ''
                          }}
                        />
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-xl hover:bg-purple-50 transition-colors text-sm font-medium">
                          <Upload className="w-4 h-4" strokeWidth={1.5} />
                          {uploadingFor === r.id ? 'Загрузка…' : 'Загрузить подписанный договор (PDF)'}
                        </span>
                      </label>
                      {salesOn ? (
                        offId === r.id ? (
                          <div className="w-full space-y-2">
                            <Textarea
                              rows={2}
                              size="sm"
                              value={offReason}
                              onChange={e => setOffReason(e.target.value)}
                              placeholder="Причина отключения продаж — автор её не увидит, идёт в журнал (от 5 символов)"
                              maxLength={1000}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleToggleSales(r, false)}
                                loading={busyId === r.id}
                                disabled={offReason.trim().length < 5}
                              >
                                Отключить продажи
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setOffId(null); setOffReason('') }}>
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setOffId(r.id); setReturnId(null) }}>
                            <XCircle className="w-4 h-4" />
                            Отключить продажи
                          </Button>
                        )
                      ) : (
                        <Button size="sm" onClick={() => handleToggleSales(r, true)} loading={busyId === r.id}>
                          <Wallet className="w-4 h-4" />
                          Включить продажи
                        </Button>
                      )}
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