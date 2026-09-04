"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Иконка «Как здесь работать?» в подвале — на всех страницах сайта.
// Передаёт адрес текущей страницы в /help?из=…, чтобы Справочник открылся
// сразу на нужном разделе. Клиентский компонент: адрес знает только браузер.
export default function HelpLink() {
  const pathname = usePathname();
  return (
    <Link
      href={`/help?из=${encodeURIComponent(pathname)}`}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300 transition-colors"
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
      Как здесь работать?
    </Link>
  );
}