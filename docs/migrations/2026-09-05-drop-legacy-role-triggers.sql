-- Удаление устаревшего автотриггера ролей, 2026-09-05
-- Проблема (баг Анатолия 05.09): при «Создать урок» админ получал
-- «Роль и одобрение профиля меняет только администратор», урок откатывался.
--
-- Причина: legacy-функция check_and_update_author_role() на триггерах
-- lessons и courses (AFTER INSERT/UPDATE/DELETE) пересчитывала контент
-- автора и принудительно ставила role = 'mentor' / 'student' в coaches
-- и profiles. После RLS-аудита 2026-09-03 роль меняет только админ
-- (guard-триггеры) — возник конфликт:
--   1) UPDATE coaches SET role='mentor' проходил (админ ещё числился),
--   2) следующий UPDATE profiles уже резался guard'ом (роль в coaches
--      сменилась) — вся транзакция откатывалась.
-- Без guard'ов триггер способен разжаловать admin/vip в mentor — вредная
-- логика. Роль теперь управляется только через /admin/users; самозапись
-- автора (кнопка «Стать автором») делает INSERT coaches и guard'ом
-- не блокируется.
--
-- Выполнено агентом через MCP (временно read_only=false, возвращено true).

drop trigger if exists trg_lessons_update_role on public.lessons;
drop trigger if exists trg_courses_update_role on public.courses;
drop function if exists check_and_update_author_role();

-- Контроль (проверено 2026-09-05):
--   lessons: 1 триггер (update_lessons_updated_at)
--   courses: 2 триггера (courses_updated_at, update_courses_updated_at —
--            дубль updated_at, к чистке техдолга)
--   check_and_update_author_role: функции нет