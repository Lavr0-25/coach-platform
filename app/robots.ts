import type { MetadataRoute } from 'next'

// Канонический домен — www (апекс rightway.su редиректит на www.rightway.su)
const SITE_URL = 'https://www.rightway.su'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Приватные и служебные разделы: кабинеты, админка, API, личные страницы
      disallow: [
        '/dashboard',
        '/admin',
        '/api',
        '/messages',
        '/notifications',
        '/favorites',
        '/feedback',
        '/profile',
        '/forgot-password',
        '/reset-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}