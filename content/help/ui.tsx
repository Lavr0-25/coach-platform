import Image from "next/image";
import type { ReactNode } from "react";

// Общий оформительский каркас разделов Справочника («Как здесь работать?»).
// Разделы в content/help/*.tsx собираются из этих деталей — так все разделы
// выглядят одинаково, и правится вид в одном месте.

// Скриншот страницы: файл public/help/<id>.png, ширина 1280.
// Рамка-подложка, чтобы светлый скрин аккуратно смотрелся в тёмной теме.
export function Shot({
  id,
  caption,
}: {
  id: string;
  caption?: string;
}) {
  return (
    <figure className="my-5">
      <div className="rounded-xl border border-purple-100 bg-white p-1.5 dark:border-white/10">
        <Image
          src={`/help/help-${id}.png`}
          alt={caption ?? "Скриншот страницы"}
          width={1280}
          height={800}
          className="w-full h-auto rounded-lg"
        />
      </div>
      {caption ? (
        <figcaption className="mt-1.5 text-xs text-gray-400 text-center">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// Заголовок внутри раздела («Что здесь можно сделать», «Частые сценарии»).
export function H({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
      {children}
    </h3>
  );
}

// Маркированный список возможностей страницы.
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

// Пошаговый сценарий («Как создать урок»): нумерованные шаги.
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-decimal pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}