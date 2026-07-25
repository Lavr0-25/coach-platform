import { redirect } from 'next/navigation'

export default function LessonRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  redirect('/')
}