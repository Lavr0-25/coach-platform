import { redirect } from 'next/navigation'

export default function CourseRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  redirect('/')
}