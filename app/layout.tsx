import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BanCheck from "@/components/BanCheck";
import HelpLink from "@/components/HelpLink";
import { SearchProvider } from "@/components/SearchContext";
import { ToastProvider } from "@/components/Toast";

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Manrope — единственный шрифт проекта, содержит полноценную кириллицу
// (Geist кириллицы не имеет — весь сайт рендерился запасным шрифтом).
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Ставит тему/палитру/размер шрифта ДО первой отрисовки — иначе посетитель
// видит «вспышку» светлой темы до применения сохранённого выбора.
const themeInit = `(function(){try{
var d=document.documentElement;
var t=localStorage.getItem('cp-theme');
d.setAttribute('data-theme', t==='light'||t==='dark' ? t : (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
var p=localStorage.getItem('cp-palette'); if(p) d.setAttribute('data-palette', p);
var f=localStorage.getItem('cp-fs'); if(f) d.setAttribute('data-fs', f);
}catch(e){}})()`;

// Приём из доков Next.js (гайд preventing-flash-before-hydration): на сервере скрипт
// рендерится как text/javascript и исполняется при загрузке страницы; при гидратации
// в браузере рендерится как text/plain и игнорируется (React не умеет исполнять
// <script> при клиентском рендере). Расхождение типа подавляет suppressHydrationWarning.
function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rightway.su"),
  title: {
    default: "RightWay — Правильный путь",
    // Вложенные страницы подставляют своё название через generateMetadata
    template: "%s | RightWay",
  },
  description: "Платформа для создания и прохождения уроков от лучших наставников",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${manrope.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        {/* Исполняется при разборе HTML, до первой отрисовки — до гидратации */}
        <InlineScript html={themeInit} />
      </head>
      <body className="min-h-screen flex flex-col">
        <SearchProvider>
          <ToastProvider>
            <Navbar />
            <BanCheck />
            <main className="flex-1 bg-gray-50 text-gray-900">{children}</main>
          </ToastProvider>
        </SearchProvider>
        <footer className="bg-white border-t border-purple-100 flex-shrink-0">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-center">
              <Link
                href="/"
                className="text-lg font-bold gradient-text hover:opacity-80 transition-opacity"
              >
                RightWay
              </Link>
              {/* Ссылки переносятся на узких экранах, а не распирают подвал */}
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-gray-500">
                <HelpLink />
                <span className="text-purple-200">·</span>
                <Link href="/terms" className="hover:text-purple-600 transition-colors">
                  Условия использования
                </Link>
                <span className="text-purple-200">·</span>
                <Link href="/privacy" className="hover:text-purple-600 transition-colors">
                  Политика конфиденциальности
                </Link>
              </div>
              <p className="text-sm text-gray-400">© 2026 RightWay. Все права защищены.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}