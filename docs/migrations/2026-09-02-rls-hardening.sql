-- Миграция 2026-09-02: укрепление RLS — владелец, а не «любой наставник»
-- Статус: к выполнению в Supabase SQL Editor
-- Закрывает: чужие уроки/контент правятся любым наставником; черновики видны всем;
-- course_lessons без политик. Админам — отдельный полный доступ.
-- Остаются без изменений (отдельный вопрос): purchases (самопокупка), analytics_events, likes,
-- таблицы тестов/reviews/reports/subscriptions (0 политик — фичи не активны).

-- ===== 1. COURSES: убрать утечку черновиков и мёртвые политики =====
drop policy if exists "courses_select_all" on courses;
drop policy if exists "courses_delete_own" on courses;
drop policy if exists "courses_insert_own" on courses;
drop policy if exists "courses_update_own" on courses;
-- остаются: публичное чтение опубликованных (is_published = true),
-- «Coaches can create/update/delete/view own courses» (по coach_id через subquery),
-- «Coaches can manage own courses», admin — см. ниже.

create policy "courses_admin_all" on courses
for all to authenticated
using (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'))
with check (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'));

-- ===== 2. LESSONS: владелец вместо «любого наставника», публично — только опубликованные =====
drop policy if exists "Allow public read access on lessons" on lessons;
drop policy if exists "Anyone can view published lessons" on lessons;
drop policy if exists "lessons_select_all" on lessons;
drop policy if exists "lessons_insert_own" on lessons;
drop policy if exists "lessons_update_own" on lessons;
drop policy if exists "lessons_delete_own" on lessons;
drop policy if exists "Mentors can create lessons" on lessons;
drop policy if exists "Mentors can update own lessons" on lessons;
drop policy if exists "Mentors can delete own lessons" on lessons;

-- Публично (включая анонимов): опубликованные уроки и уроки опубликованных курсов
create policy "lessons_public_read" on lessons
for select
using (
  is_published = true
  or exists (
    select 1 from courses c
    where c.id = lessons.course_id and c.is_published = true
  )
);

-- Наставник видит свои уроки (включая черновики)
create policy "lessons_owner_select" on lessons
for select to authenticated
using (exists (select 1 from coaches c where c.user_id = auth.uid() and c.id = lessons.coach_id));

-- Наставник создаёт уроки только от своего имени
create policy "lessons_owner_insert" on lessons
for insert to authenticated
with check (exists (select 1 from coaches c where c.user_id = auth.uid() and c.id = coach_id));

create policy "lessons_owner_update" on lessons
for update to authenticated
using (exists (select 1 from coaches c where c.user_id = auth.uid() and c.id = lessons.coach_id))
with check (exists (select 1 from coaches c where c.user_id = auth.uid() and c.id = lessons.coach_id));

create policy "lessons_owner_delete" on lessons
for delete to authenticated
using (exists (select 1 from coaches c where c.user_id = auth.uid() and c.id = lessons.coach_id));

-- Админ: всё
create policy "lessons_admin_all" on lessons
for all to authenticated
using (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'))
with check (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'));

-- ===== 3. LESSON_CONTENT: владелец через урок, вместо «любого наставника» =====
drop policy if exists "Mentors can insert content" on lesson_content;
drop policy if exists "Mentors can update content" on lesson_content;
drop policy if exists "Mentors can delete content" on lesson_content;

create policy "lesson_content_owner_insert" on lesson_content
for insert to authenticated
with check (
  exists (
    select 1 from lessons l
    join coaches c on c.id = l.coach_id
    where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
  )
);

create policy "lesson_content_owner_update" on lesson_content
for update to authenticated
using (
  exists (
    select 1 from lessons l
    join coaches c on c.id = l.coach_id
    where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from lessons l
    join coaches c on c.id = l.coach_id
    where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
  )
);

create policy "lesson_content_owner_delete" on lesson_content
for delete to authenticated
using (
  exists (
    select 1 from lessons l
    join coaches c on c.id = l.coach_id
    where l.id = lesson_content.lesson_id and c.user_id = auth.uid()
  )
);

create policy "lesson_content_admin_all" on lesson_content
for all to authenticated
using (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'))
with check (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'));

-- ===== 4. COURSE_LESSONS: включить RLS и добавить политики =====
alter table course_lessons enable row level security;

-- Публично: связи уроков с ОПУБЛИКОВАННЫМИ курсами
create policy "course_lessons_public_read" on course_lessons
for select
using (exists (select 1 from courses c where c.id = course_lessons.course_id and c.is_published = true));

-- Владелец курса: видит и управляет связями своих курсов
create policy "course_lessons_owner_all" on course_lessons
for all to authenticated
using (
  exists (
    select 1 from courses c
    join coaches co on co.id = c.coach_id
    where c.id = course_lessons.course_id and co.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from courses c
    join coaches co on co.id = c.coach_id
    where c.id = course_lessons.course_id and co.user_id = auth.uid()
  )
);

create policy "course_lessons_admin_all" on course_lessons
for all to authenticated
using (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'))
with check (exists (select 1 from coaches where user_id = auth.uid() and role = 'admin'));