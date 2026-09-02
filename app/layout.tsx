import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BanCheck from "@/components/BanCheck";

export const dynamic = 'force-dynamic'
export const revalidate = 0

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoachPlatform - Платформа для обучения",
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
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <BanCheck />
        <main className="flex-1 bg-gray-50">{children}</main>
        <footer className="bg-white border-t border-purple-100 flex-shrink-0">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <Link
                href="/"
                className="text-lg font-bold gradient-text hover:opacity-80 transition-opacity"
              >
                CoachPlatform
              </Link>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <Link href="/terms" className="hover:text-purple-600 transition-colors">
                  Условия использования
                </Link>
                <span className="text-purple-200">·</span>
                <Link href="/privacy" className="hover:text-purple-600 transition-colors">
                  Политика конфиденциальности
                </Link>
              </div>
              <p className="text-sm text-gray-400">© 2026 CoachPlatform. Все права защищены.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}