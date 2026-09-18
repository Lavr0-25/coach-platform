import type { NextConfig } from "next";

// Supabase-проект: REST/Auth (https) + Realtime (wss), если включится.
const SUPABASE_HOST = "ftokvvzgvzkphszgfjbi.supabase.co";

// Внешние плееры уроков — lib/video-embed.ts (YouTube/VK/Rutube/Дзен).
const VIDEO_FRAMES = [
  "https://www.youtube.com",
  "https://vk.com",
  "https://vkvideo.ru",
  "https://rutube.ru",
  "https://dzen.ru",
];

// CSP собирается отдельно, чтобы в dev добавить 'unsafe-eval' (React Refresh)
// и ws://localhost (HMR) — в проде их нет.
const isDev = process.env.NODE_ENV === "development";
const csp = [
  "default-src 'self'",
  // 'unsafe-inline' в script — компромисс v1: Next вставляет инлайн-бутстрап
  // скрипты без nonce. Внешние скрипты (главный вектор XSS через CDN) блокируются.
  // Строгий CSP с nonce через middleware — отдельная задача.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // https: для картинок — контент уроков (WYSIWYG) может ссылаться на любой
  // https-хост; аватарки/обложки — Supabase Storage.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}${
    isDev ? " ws://localhost:*" : ""
  }`,
  `frame-src ${VIDEO_FRAMES.join(" ")}`,
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Кликджекинг: страницу нельзя встроить в чужой iframe (дубль frame-ancestors для старых браузеров).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // MIME-sniffing: браузер не угадывает тип файла вопреки Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Браузерные API, которые продукту не нужны.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), display-capture=()",
  },
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: SUPABASE_HOST },
    ],
    // Скриншоты Справочника с cache-busting версией (?v=<mtime> в Shot).
    // search опущен = разрешена любая query-строка, но только для /help/**.
    localPatterns: [
      { pathname: "/help/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;