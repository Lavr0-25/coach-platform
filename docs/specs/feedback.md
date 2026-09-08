# Спека: Обратная связь и верификация авторов (`/feedback`)

> Статус: `stable` · обновлено 2026-09-08 · ответственный: Анатолий + Claude Code

## Задача

Пользователь пишет в поддержку (баг / идея), автор подаёт заявку на верификацию,
админ разбирает обращения и решает судьбу заявок. Один механизм — таблица
`feedback` — обслуживает оба сценария (решение Анатолия, 2026-09-08: без
отдельной таблицы заявок).

## Модель данных

Таблица `feedback`: `user_id`, `user_name`, `type`, `title`, `description`,
`images` (массив публичных ссылок на скриншоты в бакете `uploads`, путь
`feedback/`), `status`, `admin_reply`, `replied_at`, `created_at`, `updated_at`.

- `type`: `bug` | `feature` | `verification` — закреплено CHECK-констрейнтом
  `feedback_type_check` (миграция `docs/migrations/2026-09-08-verification-via-feedback.sql`).
- `status`: `new` → `in_progress` → `resolved` | `rejected`.

## Права и защита

- Пользователь видит и правит **только свои** записи: RLS-политики (своё + админ)
  и в server actions повторный фильтр `.eq('user_id', user.id)` — вторая ступень.
- Своё обращение можно отредактировать/удалить **пока статус `new`** (после
  взятия в работу текст фиксируется): `updateMyFeedback` / `deleteMyFeedback`
  в `app/actions/feedbackActions.ts` (тип `verification` разрешён в правке).
  Удаление чистит скриншоты из Storage (best-effort).
- Админские действия — через server actions с `getAdminClient()`
  (`app/admin/actions.ts`):
  - `updateFeedbackStatus` — статус + ответ (обычные обращения);
  - `updateVerificationFeedback` — **только для заявок**: статус `resolved`
    одновременно ставит `coaches.is_verified=true` автору (по `user_id` из
    заявки, фильтр `role='mentor'`); прочие статусы — снимают галочку. Галочка
    и статус меняются одной операцией админа, чтобы не разъезжались;
  - `bulkUpdateFeedbackStatus` — массовая смена статуса (заявки верификации
    через массовые действия галочку НЕ меняют — только статус).

## Поток верификации (согласовано 2026-09-08)

1. Автор в кабинете (`/dashboard/mentor/profile`, вкладка «Профиль») видит блок
   «Верификация»: статус + кнопка «Подать заявку» → `/feedback?type=verification`
   (тип предвыбран в форме).
2. Заявка = запись `feedback` типа `verification` со скриншотами/ссылками.
   **Одна активная заявка**: пока последняя заявка автора в `new`/`in_progress`,
   блок показывает жёлтый статус и кнопки подачи нет. Отклонённая — красный блок
   с причиной (`admin_reply`) и кнопкой «Подать заявку снова».
3. Админ в `/admin/feedback` (бейдж «Заявка», подсказка в модалке) принимает
   (`resolved` + ответ) или отклоняет (`rejected` + пояснение).
4. Результат: у верифицированного автора значок `BadgeCheck` «Проверенный
   автор» в каталоге `/mentors` и на профиле `/mentor/[id]`; в кабинете —
   зелёный блок + бейдж «Верифицирован».

Начальное состояние: галочка снята у всех авторов, кроме подтверждённых лично —
Георгий Кодов и Дарина Богун (миграция 2026-09-08). Снятие проверки вручную —
`/admin/coaches`, кнопка «Отменить проверку» (счётчик заявок на дэшборде
`/admin` считается по `feedback` type=verification в `new`/`in_progress`).

## Обращения (bug / feature)

Форма `/feedback`: тип, тема, описание, до 5 скриншотов (image/*, ≤5MB, бакет
`uploads`/`feedback/`). Админ: список с фильтром статуса/поиском, модалка
с ответом, статусы из select (таблица/карточки/модалка), массовые статусы,
JSON- и CSV-выгрузка. Ответ админа виден автору плашкой «Ответ поддержки».

## Спецификация ↔ код

- Форма и «Мои обращения»: `app/feedback/page.tsx`
- Server actions пользователя: `app/actions/feedbackActions.ts`
- Server actions админа: `app/admin/actions.ts`
- Админка: `app/admin/feedback/page.tsx`, дэшборд-счётчик: `app/admin/page.tsx`
- Кабинет автора: `app/dashboard/mentor/profile/page.tsx`
- Значок: `app/mentors/page.tsx`, `components/MentorProfile.tsx`
- Миграция: `docs/migrations/2026-09-08-verification-via-feedback.sql`
- Справочник (правило техписателя): `content/help/feedback.tsx`,
  `content/help/profile.tsx`, скрин `public/help/help-feedback.png`