import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

// Канонический домен — www (апекс rightway.su редиректит на www.rightway.su)
const SITE_URL = 'https://www.rightway.su'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [courses, lessons, coaches] = await Promise.all([
    supabase.from('courses').select('id, updated_at').eq('is_published', true),
    supabase.from('lessons').select('id, updated_at').eq('is_published', true),
    supabase.from('coaches').select('id, created_at'),
  ])

  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/course`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/mentors`, changeFrequency: 'weekly', priority: 0.8 },
    ...(courses.data?.map((c) => ({
      url: `${SITE_URL}/course/${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })) ?? []),
    ...(lessons.data?.map((l) => ({
      url: `${SITE_URL}/lesson/${l.id}`,
      lastModified: l.updated_at ? new Date(l.updated_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })) ?? []),
    ...(coaches.data?.map((m) => ({
      url: `${SITE_URL}/mentor/${m.id}`,
      lastModified: m.created_at ? new Date(m.created_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })) ?? []),
  ]
}