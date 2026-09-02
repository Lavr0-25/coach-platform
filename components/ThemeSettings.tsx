'use client'

import { useState, useEffect, useRef } from 'react'

/*
 * Настройки интерфейса: палитра, тема, размер шрифта.
 * Выбор хранится в localStorage (cp-palette / cp-theme / cp-fs) и применяется
 * к <html> мгновенно; до первой отрисовки атрибуты ставит inline-скрипт
 * в app/layout.tsx. Язык интерфейса появится на следующем этапе —
 * пункт уже предусмотрен в меню.
 *
 * Два варианта отображения:
 *  - по умолчанию — иконка-шестерёнка в шапке с выпадающей панелью (анонимы);
 *  - asMenuItem — пункт внутри меню профиля: панель раскрывается прямо
 *    в выпадающем меню (залогиненные — экономим место в шапке на мобильных).
 */

const PALETTES = [
  { id: 'a', name: 'Фиолет', colors: ['#8b5cf6', '#6366f1', '#3b82f6'] },
  { id: 'b1', name: 'Хвоя', colors: ['#1e5c48', '#2f7a5f', '#d97a2b'] },
  { id: 'b2', name: 'Чернила', colors: ['#1e3a5f', '#2c5282', '#ee5d4d'] },
  { id: 'b3', name: 'Графит', colors: ['#2e2e38', '#4b4b57', '#d98e04'] },
]

const FONT_SIZES = [
  { id: '85', label: 'A−', title: 'Мелкий' },
  { id: '100', label: 'A', title: 'Обычный' },
  { id: '115', label: 'A+', title: 'Крупный' },
  { id: '130', label: 'A++', title: 'Очень крупный' },
]

type ThemeChoice = 'light' | 'dark' | 'auto'

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeSettings({ asMenuItem = false }: { asMenuItem?: boolean }) {
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState('a')
  const [theme, setTheme] = useState<ThemeChoice>('auto')
  const [fs, setFs] = useState('100')
  const boxRef = useRef<HTMLDivElement>(null)

  // Подтягиваем сохранённый выбор (после монтирования — атрибуты на <html>
  // уже стоят: их поставил anti-flash скрипт из layout.tsx)
  useEffect(() => {
    const root = document.documentElement
    setPalette(root.getAttribute('data-palette') || 'a')
    setFs(root.getAttribute('data-fs') || '100')
    const saved = localStorage.getItem('cp-theme')
    setTheme(saved === 'light' || saved === 'dark' ? saved : 'auto')
  }, [])

  // Закрытие по клику вне меню (только для варианта-шестерёнки;
  // в меню профиля закрытие управляется самим меню)
  useEffect(() => {
    if (!open || asMenuItem) return
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, asMenuItem])

  const apply = (key: string, value: string | null, attr: string) => {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
    if (attr) document.documentElement.setAttribute(attr, value || attr)
  }

  const choosePalette = (id: string) => {
    setPalette(id)
    apply('cp-palette', id, 'data-palette')
  }

  const chooseTheme = (t: ThemeChoice) => {
    setTheme(t)
    if (t === 'auto') {
      localStorage.removeItem('cp-theme')
      document.documentElement.setAttribute('data-theme', systemTheme())
    } else {
      localStorage.setItem('cp-theme', t)
      document.documentElement.setAttribute('data-theme', t)
    }
  }

  const chooseFs = (v: string) => {
    setFs(v)
    localStorage.setItem('cp-fs', v)
    if (v === '100') {
      document.documentElement.removeAttribute('data-fs')
    } else {
      document.documentElement.setAttribute('data-fs', v)
    }
  }

  // Содержимое панели — общее для обоих вариантов
  const panel = (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Оформление
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => choosePalette(p.id)}
              title={p.name}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors ${
                palette === p.id
                  ? 'bg-purple-50 ring-2 ring-purple-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span
                className="w-8 h-8 rounded-full border border-gray-200"
                style={{
                  background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]} 55%, ${p.colors[2]})`,
                }}
              />
              <span className="text-[11px] font-medium text-gray-600">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Тема
        </p>
        <div className="flex rounded-xl bg-gray-50 p-1 gap-1">
          {(
            [
              { id: 'light', label: 'Светлая' },
              { id: 'dark', label: 'Тёмная' },
              { id: 'auto', label: 'Авто' },
            ] as { id: ThemeChoice; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => chooseTheme(t.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                theme === t.id
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Размер шрифта
        </p>
        <div className="flex rounded-xl bg-gray-50 p-1 gap-1">
          {FONT_SIZES.map((f) => (
            <button
              key={f.id}
              onClick={() => chooseFs(f.id)}
              title={f.title}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                fs === f.id
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Язык интерфейса</span>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            Скоро
          </span>
        </div>
      </div>
    </div>
  )

  // Вариант «пункт меню профиля»: панель раскрывается внутри меню
  if (asMenuItem) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 transition-colors"
        >
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Настройки интерфейса
        </button>

        {open && (
          <div className="mx-3 mb-2 rounded-xl border border-gray-100 bg-gray-50/50">
            {panel}
          </div>
        )}
      </div>
    )
  }

  // Вариант «шестерёнка в шапке» (для анонимов)
  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        title="Настройки интерфейса"
        aria-label="Настройки интерфейса"
        aria-expanded={open}
        className="p-2 rounded-xl text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-purple-100 z-50 overflow-hidden">
          {panel}
        </div>
      )}
    </div>
  )
}