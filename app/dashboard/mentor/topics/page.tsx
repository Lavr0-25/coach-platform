import { redirect } from 'next/navigation'

// Страница переехала в раздел «Управление с ИИ» (2026-09-03).
// Старый адрес оставлен редиректом, чтобы не ломать закладки.
export default function MentorTopicsPage() {
  redirect('/dashboard/ai/topics')
}