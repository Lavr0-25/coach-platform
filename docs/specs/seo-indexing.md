# Спека: индексация для поисковиков и ИИ-агентов (robots, llms.txt, sitemap, RSS, SSR, мета-теги)

> Статус: `stable` · обновлено 2026-09-18 · ответственный: Анатолий + Claude Code

Источник фичи — обращение пользователя (через `/admin/feedback`): GenAI-агенты
и поисковики должны находить платформу и понимать, что на ней есть.

## Канонический домен

`https://www.rightway.su` — все генерируемые ссылки (sitemap, robots, llms.txt)
используют именно его: апекс без «www» редиректит на «www».

## robots.txt — `app/robots.ts`

Метадата-маршрут Next: функция возвращает объект, Next сериализует в
`/robots.txt`. Всё разрешено, кроме приватного:

`/dashboard`, `/admin`, `/api`, `/messages`, `/notifications`, `/favorites`,
`/feedback`, `/profile`, `/forgot-password`, `/reset-password`.

Ссылка на sitemap — в конце файла.

## llms.txt — `public/llms.txt`

Статичный файл, «паспорт платформы» для ИИ-агентов (формат llmstxt.org):
описание платформы, разделы, шаблоны URL (`/course/<id>`, `/lesson/<id>`,
`/mentor/<id>`), правила цитирования. Правится руками при изменении
структуры сайта.

## sitemap.xml — `app/sitemap.ts`

Генерируется из базы при каждом запросе:

- статичные: главная, `/course`, `/mentors`;
- все `courses` с `is_published = true` (lastmod = `updated_at`);
- все `lessons` с `is_published = true` (lastmod = `updated_at`);
- все `coaches` (lastmod = `created_at`).

Новые курсы/уроки/наставники попадают в карту сами, поддержка не нужна.

## RSS-лента — `app/rss.xml/route.ts` (№28, 2026-09-17)

Задел под автозабор Дзена (№21): Дзен подключается к ленте и забирает
статьи сам, без агента.

- Route Handler `GET /rss.xml` — RSS 2.0, `Content-Type: application/xml`.
- Вход: `lessons` с `is_published = true` и `is_hidden = false`, лимит 50,
  сортировка по дате (по убыванию). `published_at` может быть null у старых
  публикаций → берётся `created_at`.
- Поля item: `title`, `link` (= канонический URL урока + `?utm_source=rss`,
  правило utm-меток), `guid` (канонический URL **без** utm — стабильный
  идентификатор записи для читателей ленты), `description` (= `description`
  урока, экранирован XML-escape), `author` (display_name ментора, если есть),
  `pubDate` (RFC-822, `toUTCString()`).
- Канонический домен тот же: `https://www.rightway.su`.
- Кэш: `revalidate = 3600` + `Cache-Control: public, max-age=3600` — лента
  пересобирается раз в час, Дзен ходит сам.
- Канал `rss` добавлен в `lib/utm.ts` (`UTM_SOURCES.rss`, подпись «RSS» в
  аналитике источников).
- Метатег zen-verification (подтверждение владения в кабинете Дзена)
  добавляется в `<head>` отдельным шагом, когда получен код из кабинета.

## SSR главной — `app/page.tsx` + `components/HomeFeed.tsx`

- `app/page.tsx` — server component: один `Promise.all` тянет курсы, уроки
  (только `is_published`), авторов, подписки пользователя и **агрегаты
  рейтингов** (по одному запросу на `reviews`/`course_reviews` вместо запроса
  на каждую карточку — устранён N+1). Нормализует данные в `HomeItem`.
- `components/HomeFeed.tsx` — client component, вся интерактивность
  (фильтры, поиск, подписки, «Загрузить ещё») работает на переданном
  наборе без обращений к базе.
- Перемешивание для фильтра «Все» — только на клиенте (на сервере порядок
  по дате), иначе гидрация расходится.
- Фильтр `is_published = true` добавлен в 2026-09-03 — раньше на главную
  попадали черновики.
- Колонка у уроков называется `is_free_preview` (не `is_free`) — сервер
  мапит её в `is_free` карточки. У курсов флага нет: `is_free = false`,
  бесплатный курс определяется `price === 0`.

### Поиск главной (2026-09-03, правка Анатолия)

- **Десктоп (lg+)**: поле поиска в шапке (`components/Navbar.tsx`), между
  лого и иконками; «резиновое» (`flex-1 min-w-0`), ширина тянется за экраном.
  Видно только на главной (`pathname === '/'`).
- **Мобильные**: прежнее поле под шапкой (`HomeFeed`, блок `lg:hidden`).
- Оба поля — одно состояние через `components/SearchContext.tsx`
  (React-контекст, провайдер в `app/layout.tsx`).

## Мета-теги — generateMetadata / metadata

`app/layout.tsx`: `metadataBase = https://www.rightway.su`, шаблон заголовка
`%s | RightWay` (вложенные страницы задают только своё имя).

| Страница | Механизм | Title | Description | OG image |
|---|---|---|---|---|
| `/course/[id]` | generateMetadata | название курса | описание (≤160) | обложка |
| `/lesson/[id]` | generateMetadata | название — автор | описание (≤160) | обложка |
| `/mentor/[id]` | generateMetadata | имя — специализация | био (≤160) | аватар |
| `/mentors` | статичный metadata | «Наставники» | фиксированный | — |

`mentor/[id]` — единственная из них, где понадобился рефактор: страница была
целиком `'use client'`. Теперь: серверная обёртка `app/mentor/[id]/page.tsx`
(generateMetadata + проверка существования профиля через `notFound()`) и
клиентский `components/MentorProfile.tsx` (интерактив, получает `coachId`).

## OG-карточки-фолбэк — `app/api/og/route.tsx` (фича Б, 2026-09-18)

У соцсетей и мессенджеров есть одна картинка на ссылку (og:image). Если у
материала нет обложки/аватара, показывалась бы серая заглушка — ссылка
выглядела «мёртвой».

- `GET /api/og?t=<название>&a=<автор>` — рисует карточку 1200×630: градиент
  бренда, логотип «W RightWay», название (≤90 символов), автор (≤60),
  `www.rightway.su`. Рендер через `next/og` (Satori) на Node.js runtime.
- Шрифты Inter (400 + 700, латиница + кириллица) лежат в `public/fonts/` —
  Satori рендерит только с явно загруженными TTF; оба начертания нужны
  (заголовки жирные). Кэшируются неявно самим роутом.
- Хелпер `ogCardUrl(title, author?)` в `lib/seo.ts` строит URL карточки;
  `absoluteUrl(path)` — абсолютные ссылки для JSON-LD.
- Подключено в generateMetadata всех 4 страниц: если своей картинки нет —
  `images: [/api/og?...]` (относительный путь достраивается `metadataBase`).
- Названия материалов экранируются (`esc()`) — Satori не HTML, спецсимволы
  (`<>&'"`) из названий могут сломать рендер.

## JSON-LD (структурированные данные) — фича Б, 2026-09-18

Поисковики читают машиночитаемое описание прямо со страницы (`<script
type="application/ld+json">`), чтобы показывать расширенные сниппеты.

| Страница | @type | Поля |
|---|---|---|
| `/lesson/[id]` | `LearningResource` | name, description, image, datePublished, author (Person + ссылка на /mentor), offers (цена ₽), isAccessibleForFree |
| `/course/[id]` | `Course` | name, description, image, provider (Person), offers (цена ₽), isAccessibleForFree |
| `/mentor/[id]` | `Person` | name, jobTitle (= специализация), description (= био ≤300), image, url |

- Рендерится в server-компонентах страниц; урок/курс — внутри `<main>`,
  ментор — во фрагменте рядом с клиентским компонентом.
- `isAccessibleForFree` = `price === 0 || is_free_preview` — так Google
  отличает открытые материалы от paywall.

## Кнопка «Поделиться» — `components/ShareButton.tsx` (фича Б+, 2026-09-18)

Распространение материалов читателями — бесплатный канал привлечения.

- Стоит на 4 страницах: урок (ряд статистики), курс (ряд статистики),
  профиль автора (`MentorProfile`), профиль студента.
- Ссылка всегда с `utm_source=share` (правило utm-меток, `lib/utm.ts`) —
  в аналитике источников виден канал «Поделиться».
- Поведение: если браузер умеет (`navigator.share`) — системная шторка
  шаринга (на мобильном — «отправить в мессенджер»); иначе копирование
  ссылки в буфер + надпись «Скопировано» 2,5 секунды. Закрытая шторка —
  не событие и не ошибка.
- Событие `share` пишется в `analytics_events` (event_type `share`,
  metadata `{ channel: 'native' | 'copy' }`). Гостям разрешено отдельной
  RLS-политикой `analytics_anon_insert_share` (user_id IS NULL);
  залогиненных пускает общая `analytics_insert_own`. Миграция
  `docs/migrations/2026-09-18-share-event.sql` (2 шага: CHECK event_type
  + RLS-политика, урок 17.09 о 3 уровнях блокировки).
- Ошибка записи события не ломает шаринг (try/catch) — распространение
  важнее аналитики.
- Воронка в аналитике автора: «Поделиться» — это верх воронки (материал
  разошёлся), переход по ссылке с `utm_source=share` — низ (вернулся читатель).

## Границы / открытые вопросы

- llms.txt статичный: при смене структуры URL править вручную.
- Черновики не попадают ни в sitemap, ни на главную — индексация только
  опубликованного.
- `metadataBase` нужен, чтобы Next не ругался и строил абсолютные OG-URL.

## История

- 2026-09-18 — фича Б/Б+: OG-карточки-фолбэк (`/api/og`, Satori + Inter),
  JSON-LD (LearningResource/Course/Person), кнопка «Поделиться» на 4
  страницах (utm_source=share, событие share в analytics_events).
- 2026-09-17 — №28: RSS-лента `/rss.xml` (route handler из БД, кэш 1 час,
  utm_source=rss) — задел под автозабор Дзена.
- 2026-09-03 — фича целиком (обращение пользователя): robots.ts, llms.txt,
  sitemap.ts из БД, SSR главной, мета-теги 4 страниц; поиск главной перенесён
  в шапку на десктопе.