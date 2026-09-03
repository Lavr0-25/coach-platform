import { redirect } from 'next/navigation'

// Страница переехала в раздел «Управление с ИИ» (2026-09-03).
// Старый адрес оставлен редиректом, чтобы не ломать закладки и ссылки из писем.
export default function ApiKeysRedirectPage() {
  redirect('/dashboard/ai/keys')
}