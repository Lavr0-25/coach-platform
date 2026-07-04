'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function Home() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-5xl font-bold mb-4">
          Добро пожаловать! 👋
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Платформа для обучения и создания уроков
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link 
            href="/catalog" 
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            📚 Каталог уроков
          </Link>
          
          {!loading && !user && (
            <Link 
              href="/login" 
              className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
            >
              🔐 Войти
            </Link>
          )}
          
          {!loading && user && (
            <Link 
              href="/dashboard/mentor" 
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors inline-flex items-center gap-2"
            >
              📝 Мой кабинет
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}