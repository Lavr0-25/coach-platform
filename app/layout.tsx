import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
        <main className="flex-1 bg-gray-50">{children}</main>
        <footer className="bg-white border-t flex-shrink-0">
          <div className="container mx-auto px-4 py-3 text-center text-gray-500 text-sm">
            <p>© CoachPlatform. Все права защищены.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}