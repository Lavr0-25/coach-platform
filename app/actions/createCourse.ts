'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createCourse() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) {
    throw new Error('Coach не найден')
  }

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      title: 'Новый курс',
      description: '',
      price: 0,
      is_published: false,
      coach_id: coach.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating course:', error)
    throw new Error(error.message)
  }

  redirect(`/dashboard/mentor/courses/${course.id}/edit`)
}