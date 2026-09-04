'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  setLessonHidden,
  setLessonLinkAccess,
  addLessonAccess,
  revokeLessonAccess,
} from '@/app/actions/hiddenLesson'

// Панель скрытого режима урока (2026-09-04).
// Выключен режим: строка с кнопкой «Сделать скрытым».
// Включён: статус, переключатель приёма по ссылке, копирование ссылки,
// поиск людей (profiles читается всеми — обычного клиента достаточно),
// список допущенных (аватар + пометка «по ссылке»/«вручную») и отзыв доступа.

type AccessRow = {
  id: string
  user_id: string
  source: 'manual' | 'link'
  revoked: boolean
  created_at: string
}

type ProfileRow = {
  // profiles.id совпадает с id пользователя из auth.users
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

type Props = {
  lessonId: string
  courseId: string | null
  hasSavedContent: boolean
  isHidden: boolean
  linkAccess: boolean
  onHiddenChanged: (hidden: boolean) => void
}

// Переключатель-тумблер (role="switch"): компактный на мобильном,
// состояние видно с первого взгляда — лучше текстовых кнопок вкл/выкл.
function ToggleSwitch({ checked, onChange, disabled, title }: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function HiddenLessonPanel({
  lessonId,
  courseId,
  hasSavedContent,
  isHidden,
  linkAccess,
  onHiddenChanged,
}: Props) {
  const supabase = createClient()

  const [hidden, setHidden] = useState(isHidden)
  const [linkMode, setLinkMode] = useState(linkAccess)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)

  // Список допущенных + поиск
  const [accessList, setAccessList] = useState<AccessRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  // Публичные имена авторов (coaches.display_name) — на платформе видны именно они,
  // поэтому в поиске и списке показываем их в первую очередь
  const [coachNames, setCoachNames] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProfileRow[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => { setHidden(isHidden) }, [isHidden])
  useEffect(() => { setLinkMode(linkAccess) }, [linkAccess])

  // Список допущенных — только у скрытого урока
  useEffect(() => {
    if (!hidden) return
    loadAccessList()
  }, [hidden])

  const loadAccessList = async () => {
    const { data } = await supabase
      .from('lesson_access')
      .select('id, user_id, source, revoked, created_at')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })

    const rows = (data || []) as AccessRow[]
    setAccessList(rows)
    loadProfiles(rows.map((r) => r.user_id))
    loadCoachNames(rows.map((r) => r.user_id))
  }

  // Аватарки/имена допущенных — profiles открыт для чтения всем.
  // В profiles ключ — id (= id пользователя из auth.users), колонки user_id нет.
  const loadProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds)

    const map: Record<string, ProfileRow> = { ...profiles }
    for (const p of (data || []) as ProfileRow[]) map[p.id] = p
    setProfiles(map)
  }

  // Публичные имена авторов — coaches открыт для чтения (profiles/используется на всех страницах)
  const loadCoachNames = async (userIds: string[]) => {
    if (userIds.length === 0) return
    const { data } = await supabase
      .from('coaches')
      .select('user_id, display_name')
      .in('user_id', userIds)

    const map: Record<string, string> = { ...coachNames }
    for (const c of (data || []) as { user_id: string; display_name: string | null }[]) {
      if (c.display_name) map[c.user_id] = c.display_name
    }
    setCoachNames(map)
  }

  // Поиск: имя профиля, email или публичное имя автора — минимум 2 символа
  useEffect(() => {
    if (!hidden || query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      const q = query.trim()
      const [profilesRes, coachesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(8),
        supabase
          .from('coaches')
          .select('user_id, display_name')
          .ilike('display_name', `%${q}%`)
          .limit(8),
      ])

      // Сливаем: авторы из coaches, чьих профилей ещё нет в выборке, добираются из profiles
      const byId = new Map<string, ProfileRow>()
      for (const p of (profilesRes.data || []) as ProfileRow[]) byId.set(p.id, p)
      const coachIds = ((coachesRes.data || []) as { user_id: string }[])
        .map((c) => c.user_id)
        .filter((id) => !byId.has(id))
      if (coachIds.length > 0) {
        const { data: extra } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', coachIds)
        for (const p of (extra || []) as ProfileRow[]) byId.set(p.id, p)
      }
      loadCoachNames(Array.from(byId.keys()))

      setResults(Array.from(byId.values()).filter((p) => !accessList.some((a) => a.user_id === p.id && !a.revoked)))
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, hidden, accessList])

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  const handleToggleHidden = async () => {
    setError('')

    if (!hidden && courseId) {
      const ok = window.confirm(
        'Урок сейчас входит в курс. Скрытый урок — всегда самостоятельный: он будет убран из курса.\n\nПродолжить?'
      )
      if (!ok) return
    }

    setToggling(true)
    const result = await setLessonHidden(lessonId, !hidden)
    setToggling(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setHidden(!hidden)
    onHiddenChanged(!hidden)
    if (result.detachedCourse) {
      flash('Урок убран из курса — скрытый урок всегда самостоятельный')
    } else {
      flash(!hidden
        ? 'Скрытый режим включён — урок исчезнет из каталога и поиска'
        : 'Скрытый режим выключен — урок снова опубликован открыто')
    }
  }

  const handleToggleLink = async () => {
    setError('')
    setToggling(true)
    const result = await setLessonLinkAccess(lessonId, !linkMode)
    setToggling(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setLinkMode(!linkMode)
    flash(!linkMode
      ? 'Приём по ссылке включён — перешедшие попадают в список автоматически'
      : 'Приём по ссылке выключен — теперь только личные приглашения')
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/lesson/${lessonId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API может быть недоступен (не https / старый браузер)
      window.prompt('Скопируйте ссылку вручную:', url)
    }
  }

  const handleAdd = async (targetUserId: string) => {
    setError('')
    setAdding(targetUserId)
    const result = await addLessonAccess(lessonId, targetUserId)
    setAdding(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setQuery('')
    setResults([])
    await loadAccessList()
    flash('Доступ выдан')
  }

  const handleRevoke = async (accessId: string) => {
    setError('')
    const result = await revokeLessonAccess(lessonId, accessId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAccessList((rows) => rows.map((r) => (r.id === accessId ? { ...r, revoked: true } : r)))
    flash('Доступ отозван — по ссылке он тоже больше не откроется')
  }

  const activeList = accessList.filter((a) => !a.revoked)
  const revokedList = accessList.filter((a) => a.revoked)

  const profileOf = (a: AccessRow) => profiles[a.user_id]
  // Публичное имя автора важнее: пользователи знают авторов по нему
  const displayName = (p?: ProfileRow) =>
    (p && coachNames[p.id]) || p?.full_name?.trim() || p?.email || 'Пользователь'

  const avatar = (p?: ProfileRow, size = 'h-9 w-9') =>
    p?.avatar_url ? (
      <img src={p.avatar_url} alt="" className={`${size} rounded-full object-cover flex-shrink-0`} />
    ) : (
      <div className={`${size} rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-semibold flex-shrink-0`}>
        {displayName(p).charAt(0).toUpperCase()}
      </div>
    )

  // Выключенный режим: одна строка с переключателем
  if (!hidden) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-xl leading-none mt-0.5">👁</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Обычный урок</p>
            <p className="text-sm text-gray-600">
              Виден в каталоге и поиске (когда опубликован). Включите переключатель — урок станет скрытым: только по ссылке и приглашениям.
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={false}
          onChange={handleToggleHidden}
          disabled={toggling || !hasSavedContent}
          title={!hasSavedContent ? 'Сначала заполните и сохраните контент урока' : 'Сделать урок скрытым'}
        />
      </div>
    )
  }

  // Включённый режим: полная панель
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl leading-none mt-0.5">🔒</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Скрытый урок</p>
            <p className="text-sm text-gray-600">
              Не виден в каталоге, поиске и профиле автора. Открыт только допущенным — по ссылке и/или личному приглашению.
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked
          onChange={handleToggleHidden}
          disabled={toggling}
          title="Выключить скрытый режим"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm mt-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-xl text-sm mt-3">
          {notice}
        </div>
      )}

      {/* Ссылка */}
      <div className="mt-4 bg-white rounded-xl border border-indigo-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Приём по ссылке</p>
            <p className="text-sm text-gray-500">
              {linkMode
                ? 'Перешедший по ссылке попадает в список допущенных автоматически (пометка «по ссылке»)'
                : 'Ссылка не открывает урок — только личные приглашения ниже'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              {copied ? '✓ Скопировано' : 'Скопировать ссылку'}
            </button>
            <ToggleSwitch
              checked={linkMode}
              onChange={handleToggleLink}
              disabled={toggling}
              title={linkMode ? 'Выключить приём по ссылке' : 'Включить приём по ссылке'}
            />
          </div>
        </div>
      </div>

      {/* Приглашения */}
      <div className="mt-4 bg-white rounded-xl border border-indigo-100 p-4">
        <p className="font-semibold text-gray-900 text-sm">Пригласить человека</p>
        <p className="text-sm text-gray-500 mt-0.5">Начните вводить имя или email — выберите из списка (видны аватарка, имя и почта)</p>
        <div className="relative mt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Иван Петров или ivan@mail.ru"
            className="w-full px-4 py-2.5 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">поиск…</span>
          )}
          {results.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-purple-100 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(p.id)}
                    disabled={adding === p.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 text-left disabled:opacity-50"
                  >
                    {avatar(p, 'h-9 w-9')}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{displayName(p)}</span>
                      {p.email && (
                        <span className="block text-xs text-gray-500 truncate">{p.email}</span>
                      )}
                    </span>
                    <span className="text-sm text-purple-600 font-semibold whitespace-nowrap flex-shrink-0">
                      {adding === p.id ? 'добавляю…' : 'Дать доступ'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Список допущенных */}
      <div className="mt-4 bg-white rounded-xl border border-indigo-100 p-4">
        <p className="font-semibold text-gray-900 text-sm">
          Допущены: {activeList.length}
        </p>
        {activeList.length === 0 ? (
          <p className="text-sm text-gray-500 mt-1">
            Пока никого. {linkMode ? 'Отправьте ссылку — перешедшие появятся здесь автоматически.' : 'Пригласите человека выше.'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {activeList.map((a) => {
              const p = profileOf(a)
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  {avatar(p)}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{displayName(p)}</span>
                    {p?.full_name?.trim() && p?.email && (
                      <span className="block text-xs text-gray-500 truncate">{p.email}</span>
                    )}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                    a.source === 'link'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {a.source === 'link' ? 'по ссылке' : 'вручную'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(a.id)}
                    className="text-sm text-red-600 hover:text-red-700 font-semibold px-2 py-1 flex-shrink-0"
                  >
                    Отозвать
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {revokedList.length > 0 && (
          <details className="mt-3">
            <summary className="text-sm text-gray-500 cursor-pointer select-none">
              Отозванные: {revokedList.length}
            </summary>
            <ul className="mt-1 divide-y divide-gray-100">
              {revokedList.map((a) => {
                const p = profileOf(a)
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2 opacity-60">
                    {avatar(p)}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-700 truncate">{displayName(p)}</span>
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium flex-shrink-0">
                      доступ отозван
                    </span>
                  </li>
                )
              })}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}