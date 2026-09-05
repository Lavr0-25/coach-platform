'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { toggleProfileSubscription } from '@/app/actions/profileSubscription'
import { MessageCircle, UserPlus, UserCheck } from 'lucide-react'

/** Круглая кнопка-иконка с подсказкой при наведении. */
function ActionButton({
  href,
  onClick,
  label,
  active,
  disabled,
  children,
}: {
  href?: string
  onClick?: () => void
  label: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  const className = `group relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
    active
      ? 'border-purple-300 bg-purple-100 text-purple-700'
      : 'border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100'
  }`

  const inner = (
    <>
      {children}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </>
  )

  return href ? (
    <Link href={href} className={className} title={label} aria-label={label}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={className} aria-label={label}>
      {inner}
    </button>
  )
}

/**
 * Действия на публичной странице профиля: «Написать сообщение» и подписка.
 * Кнопки — только иконки, название показывается при наведении.
 */
export default function ProfileActions({ profileId }: { profileId: string }) {
  const supabase = createClient()
  const toast = useToast()
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true

    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id === profileId || !mounted) return

      const { data } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('coach_id', profileId)
        .maybeSingle()
      if (mounted) setSubscribed(!!data)
    }

    check()
    return () => { mounted = false }
  }, [profileId])

  async function toggleSubscription() {
    if (subscribed && !confirm('Отписаться от этого автора?')) return
    setBusy(true)
    try {
      const result = await toggleProfileSubscription(profileId)
      if (!result.ok) {
        toast.showToast(result.error, 'error')
        return
      }
      setSubscribed(result.subscribed)
      toast.showToast(result.subscribed ? 'Вы подписались' : 'Вы отписались', 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <ActionButton href={`/messages/${profileId}`} label="Написать сообщение">
        <MessageCircle className="h-5 w-5" />
      </ActionButton>
      <ActionButton
        onClick={toggleSubscription}
        label={subscribed ? 'Отписаться' : 'Подписаться'}
        active={subscribed}
      >
        {subscribed ? <UserCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
      </ActionButton>
    </div>
  )
}