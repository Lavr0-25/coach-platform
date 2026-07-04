-- ============================================
-- ТАБЛИЦА ПРОФИЛЕЙ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('student', 'coach', 'admin')) NOT NULL DEFAULT 'student',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_is_approved ON public.profiles(is_approved);

-- ============================================
-- ТАБЛИЦА СОГЛАСИЙ НА ОБРАБОТКУ ПДН
-- ============================================
CREATE TABLE public.user_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT CHECK (document_type IN ('privacy_policy', 'terms_of_service', 'author_agreement')) NOT NULL,
  agreed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  UNIQUE(user_id, document_type)
);
-- ============================================
-- ТАБЛИЦА КОУЧЕЙ (расширение профиля)
-- ============================================
CREATE TABLE public.coaches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  specialization TEXT,
  website TEXT,
  telegram TEXT,
  vk TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 20.00,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coaches_user_id ON public.coaches(user_id);

-- ============================================
-- ТАБЛИЦА КУРСОВ
-- ============================================
CREATE TABLE public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  price DECIMAL(10,2) DEFAULT 0.00,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_coach_id ON public.courses(coach_id);
CREATE INDEX idx_courses_is_published ON public.courses(is_published);

-- ============================================
-- ТАБЛИЦА МОДУЛЕЙ КУРСА
-- ============================================
CREATE TABLE public.modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_course_id ON public.modules(course_id);

-- ============================================
-- ТАБЛИЦА УРОКОВ
-- ============================================
CREATE TABLE public.lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0.00,
  is_free_preview BOOLEAN DEFAULT FALSE,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_course_id ON public.lessons(course_id);
CREATE INDEX idx_lessons_module_id ON public.lessons(module_id);
-- ============================================
-- ТАБЛИЦА КОНТЕНТА УРОКА (абстракция)
-- ============================================
CREATE TABLE public.lesson_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT CHECK (content_type IN ('youtube', 'vimeo', 'vk_video', 'yandex_disk', 'pdf', 'image', 'presentation')) NOT NULL,
  content_url TEXT NOT NULL,
  access_password TEXT,
  is_external_link BOOLEAN DEFAULT true,
  title TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lesson_content_lesson_id ON public.lesson_content(lesson_id);

-- ============================================
-- ТАБЛИЦА ТЕСТОВ
-- ============================================
CREATE TABLE public.tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tests_lesson_id ON public.tests(lesson_id);
CREATE INDEX idx_tests_course_id ON public.tests(course_id);

-- ============================================
-- ТАБЛИЦА ВОПРОСОВ ТЕСТА
-- ============================================
CREATE TABLE public.test_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('single_choice', 'multiple_choice')) NOT NULL DEFAULT 'single_choice',
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_questions_test_id ON public.test_questions(test_id);

-- ============================================
-- ТАБЛИЦА ВАРИАНТОВ ОТВЕТОВ
-- ============================================
CREATE TABLE public.test_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES public.test_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_answers_question_id ON public.test_answers(question_id);

-- ============================================
-- ТАБЛИЦА ПОКУПОК
-- ============================================
CREATE TABLE public.purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  coach_earnings DECIMAL(10,2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  prodamus_order_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT purchase_target CHECK (
    (course_id IS NOT NULL AND lesson_id IS NULL) OR
    (course_id IS NULL AND lesson_id IS NOT NULL)
  )
);

CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX idx_purchases_payment_status ON public.purchases(payment_status);
-- ============================================
-- ТАБЛИЦА ПРОГРЕССА КУРСА
-- ============================================
CREATE TABLE public.course_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  completed_lessons INTEGER DEFAULT 0,
  total_lessons INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_course_progress_user_id ON public.course_progress(user_id);

-- ============================================
-- ТАБЛИЦА РЕЗУЛЬТАТОВ ТЕСТОВ
-- ============================================
CREATE TABLE public.test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_results_user_id ON public.test_results(user_id);

-- ============================================
-- ТАБЛИЦА КОММЕНТАРИЕВ
-- ============================================
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  status TEXT CHECK (status IN ('published', 'pending', 'hidden')) DEFAULT 'published',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_lesson_id ON public.comments(lesson_id);
CREATE INDEX idx_comments_status ON public.comments(status);

-- ============================================
-- ТАБЛИЦА ЛАЙКОВ
-- ============================================
CREATE TABLE public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, COALESCE(user_id, ip_address::uuid))
);

CREATE INDEX idx_likes_lesson_id ON public.likes(lesson_id);

-- ============================================
-- ТАБЛИЦА ЖАЛОБ НА КОММЕНТАРИИ
-- ============================================
CREATE TABLE public.comment_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  reason TEXT CHECK (reason IN ('spam', 'offensive', 'links', 'other')) NOT NULL,
  description TEXT,
  ip_address TEXT,
  status TEXT CHECK (status IN ('pending', 'reviewed', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comment_reports_comment_id ON public.comment_reports(comment_id);
CREATE INDEX idx_comment_reports_status ON public.comment_reports(status);

-- ============================================
-- ТАБЛИЦА ЗАПРЕЩЕННЫХ СЛОВ
-- ============================================
CREATE TABLE public.banned_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Начальный список запрещенных слов (можешь потом изменить в базе)
INSERT INTO public.banned_words (word) VALUES ('мат1'), ('мат2'), ('оскорбление1');

-- ============================================
-- ТАБЛИЦА ПРОСМОТРОВ
-- ============================================
CREATE TABLE public.views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_views_lesson_id ON public.views(lesson_id);
-- ============================================
-- ФУНКЦИЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггеры для автообновления updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ФУНКЦИЯ СОЗДАНИЯ ПРОФИЛЯ ПРИ РЕГИСТРАЦИИ
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер создания профиля при регистрации в Supabase Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Базовая защита
-- ============================================

-- Включаем RLS для всех основных таблиц
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Политики RLS (разрешаем чтение всем, изменение только владельцам)

-- 1. Профили: все могут читать, пользователь меняет только свой
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Коучи: все видят одобренных коучей
CREATE POLICY "Anyone can view approved coaches" ON public.coaches FOR SELECT USING (is_verified = true);
CREATE POLICY "Coaches can update own profile" ON public.coaches FOR UPDATE USING (auth.uid() = user_id);

-- 3. Курсы и уроки: все видят опубликованные
CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT USING (is_published = true);
CREATE POLICY "Coaches can manage own courses" ON public.courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE user_id = auth.uid() AND id = coach_id)
);

CREATE POLICY "Anyone can view lessons of published courses" ON public.lessons FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND is_published = true)
);

-- 4. Контент уроков: все видят контент опубликованных уроков
CREATE POLICY "Anyone can view content of published lessons" ON public.lesson_content FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lessons l JOIN public.courses c ON l.course_id = c.id WHERE l.id = lesson_content.lesson_id AND c.is_published = true)
);

-- 5. Покупки и прогресс: пользователь видит только свои данные
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own progress" ON public.course_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.course_progress FOR ALL USING (auth.uid() = user_id);

-- 6. Комментарии и лайки: все могут читать и создавать
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert comments" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert likes" ON public.likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);