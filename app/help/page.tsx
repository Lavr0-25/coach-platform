import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SECTIONS } from "@/content/help/sections";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Справочник",
  description:
    "Как здесь работать: инструкции по страницам кабинета автора и админ-панели RightWay.",
};

// Справочник «Как здесь работать?» — открывается из иконки в подвале любой
// страницы. Иконка передаёт адрес страницы в параметре «из» — читателя сразу
// приводит к разделу этой страницы; остальные разделы — из оглавления.
export default async function HelpPage({
  searchParams,
}: {
  // В Next 16 searchParams приходит обещанием — обязательно await.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const from = typeof params["из"] === "string" ? params["из"] : undefined;
  const wanted = typeof params["раздел"] === "string" ? params["раздел"] : undefined;

  // Админские разделы показываем только админам (роль — в coaches.role)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: coach } = await supabase
      .from("coaches")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = coach?.role === "admin";
  }
  const visibleSections = isAdmin
    ? SECTIONS
    : SECTIONS.filter((s) => s.id !== "admin" && s.id !== "moderation");

  const active =
    (wanted ? visibleSections.find((s) => s.id === wanted) : undefined) ??
    (from ? visibleSections.find((s) => s.match(from)) : undefined) ??
    visibleSections[0];

  // pt-24/28 — чтобы контент не прятался под фиксированной шапкой (65px)
  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:pt-28 max-w-4xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          <BookOpen className="w-7 h-7 text-purple-600" strokeWidth={1.5} />
          Как здесь работать
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-500 dark:text-gray-400">
          Справочник по страницам платформы: что на них есть и что можно
          сделать. Обновляется вместе с интерфейсом.
        </p>
      </header>

      {/* Оглавление: чипы-ссылки, текущий раздел выделен */}
      <nav
        aria-label="Оглавление справочника"
        className="flex flex-wrap gap-2 mb-8"
      >
        {visibleSections.map((s) => {
          const isActive = s.id === active.id;
          return (
            <Link
              key={s.id}
              href={`/help?раздел=${s.id}`}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "inline-flex items-center gap-1.5 rounded-full bg-purple-600 text-white text-sm font-medium px-3.5 py-1.5 transition-colors"
                  : "inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-white/10 text-sm text-gray-600 dark:text-gray-300 px-3.5 py-1.5 hover:border-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              }
            >
              <s.icon className="w-4 h-4" aria-hidden strokeWidth={1.5} />
              {s.title}
            </Link>
          );
        })}
      </nav>

      {/* Текст раздела */}
      <article className="bg-white dark:bg-gray-800/50 rounded-2xl border border-purple-100 dark:border-white/10 p-5 md:p-8">
        <h2 className="flex items-center gap-2 text-xl md:text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          <active.icon
            className="w-6 h-6 text-purple-600 dark:text-purple-400"
            aria-hidden
            strokeWidth={1.5}
          />
          {active.title}
        </h2>
        {active.content}
      </article>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Не нашли ответ? Задайте вопрос через{" "}
        <Link
          href="/feedback?type=question"
          className="text-purple-600 dark:text-purple-300 hover:underline"
        >
          форму обращений
        </Link>{" "}
        — тип «Вопрос» будет выбран сразу.
      </p>
    </div>
  );
}