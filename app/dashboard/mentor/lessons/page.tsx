'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function MentorLessonsPage() {
  const [lessons, setLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadLessons()
  }, [])

  // Debounce для поиска (300ms, после 3 символов)
  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setDebouncedSearch('')
    }
  }, [searchQuery])

  const loadLessons = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!coach) {
      redirect('/dashboard/mentor')
    }

    const { data: lessonsData } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        price,
        is_free_preview,
        cover_image,
        created_at
      `)
      .eq('coach_id', coach.id)
      .order('created_at', { ascending: false })

    // Связи с курсами: урок может быть в нескольких курсах (таблица course_lessons)
    const lessonIds = (lessonsData || []).map(l => l.id)
    let coursesByLesson = new Map<string, { id: string; title: string }[]>()
    if (lessonIds.length > 0) {
      const { data: linksData } = await supabase
        .from('course_lessons')
        .select('lesson_id, courses ( id, title )')
        .in('lesson_id', lessonIds)

      for (const link of linksData || []) {
        const course = Array.isArray(link.courses) ? link.courses[0] : link.courses
        if (!course) continue
        const list = coursesByLesson.get(link.lesson_id) || []
        list.push(course as { id: string; title: string })
        coursesByLesson.set(link.lesson_id, list)
      }
    }

    setLessons((lessonsData || []).map(l => ({
      ...l,
      courses: coursesByLesson.get(l.id) || [],
    })))
    setLoading(false)
  }

  // Фильтрация уроков
  const filteredLessons = debouncedSearch
    ? lessons.filter(l => 
        l.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (l.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) || false)
      )
    : lessons

  // Группируем уроки: в курсах (есть связь в course_lessons) и свободные
  const lessonsInCourses = filteredLessons?.filter(l => l.courses && l.courses.length > 0) || []
  const lessonsWithoutCourse = filteredLessons?.filter(l => !l.courses || l.courses.length === 0) || []
  const freeLessons = filteredLessons?.filter(l => l.is_free_preview) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl pt-24 sm:pt-28">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <Link href="/dashboard/mentor" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group mb-2">
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад в кабинет
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold gradient-text">
              Мои уроки
            </h1>
            <p className="text-gray-600 mt-2">
              Управление учебными материалами и видео
            </p>
          </div>
          
          <Link
            href="/dashboard/mentor/lessons/new"
            className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать урок
          </Link>
        </div>

        {/* Поиск */}
        <div className="mt-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по урокам..."
              className="w-full px-5 py-3 pl-12 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
            <svg 
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {debouncedSearch && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Найдено: <span className="font-bold text-purple-700">{filteredLessons.length}</span> уроков
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Сбросить поиск
              </button>
            </div>
          )}
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {filteredLessons.length}
            </div>
            <div className="text-sm text-gray-600">
              Всего уроков
            </div>
          </div>
          
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {lessonsInCourses.length}
            </div>
            <div className="text-sm text-gray-600">
              В курсах
            </div>
          </div>
          
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {lessonsWithoutCourse.length}
            </div>
            <div className="text-sm text-gray-600">
              Отдельные
            </div>
          </div>
          
          <div className="style-card p-4 text-center">
            <div className="text-3xl font-bold gradient-text mb-1">
              {freeLessons.length}
            </div>
            <div className="text-sm text-gray-600">
              Бесплатных
            </div>
          </div>
        </div>
      </div>

      {/* Уроки в курсах */}
      {lessonsInCourses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
            Уроки в курсах {debouncedSearch && <span className="text-base text-gray-500">({lessonsInCourses.length})</span>}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonsInCourses.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                {/* Обложка */}
                <div className="relative aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  {lesson.cover_image ? (
                    <Image
                      src={lesson.cover_image}
                      alt={lesson.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="w-full h-full object-cover transition-transform duration-300"
                    />
                  ) : (
                    <span className="opacity-50">🎥</span>
                  )}
                </div>

                {/* Информация */}
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {lesson.title}
                </h3>

                {lesson.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {lesson.description}
                  </p>
                )}

                {/* Курс */}
                {lesson.courses && lesson.courses.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 px-2.5 py-1.5 rounded-lg mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="font-medium truncate">
                      {lesson.courses[0].title}{lesson.courses.length > 1 ? ` +${lesson.courses.length - 1}` : ''}
                    </span>
                  </div>
                )}

                {/* Мета-информация */}
                <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                  <div className="flex items-center gap-2">
                    {lesson.is_free_preview ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Бесплатно
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-purple-700">
                        {lesson.price} ₽
                      </span>
                    )}
                  </div>
                  
                  <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Редактировать
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Отдельные уроки (без курса) */}
      {lessonsWithoutCourse.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Отдельные уроки {debouncedSearch && <span className="text-base text-gray-500">({lessonsWithoutCourse.length})</span>}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonsWithoutCourse.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100"
              >
                {/* Обложка */}
                <div className="relative aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden">
                  {lesson.cover_image ? (
                    <Image
                      src={lesson.cover_image}
                      alt={lesson.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="w-full h-full object-cover transition-transform duration-300"
                    />
                  ) : (
                    <span className="opacity-50">📄</span>
                  )}
                </div>

                {/* Информация */}
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {lesson.title}
                </h3>

                {lesson.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {lesson.description}
                  </p>
                )}

                {/* Мета-информация */}
                <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                  <div className="flex items-center gap-2">
                    {lesson.is_free_preview ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Бесплатно
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-purple-700">
                        {lesson.price} ₽
                      </span>
                    )}
                  </div>
                  
                  <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Редактировать
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Если уроков нет или ничего не найдено */}
      {filteredLessons.length === 0 && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {debouncedSearch ? 'Ничего не найдено' : 'Пока нет уроков'}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {debouncedSearch 
              ? `По запросу "${debouncedSearch}" уроков не найдено.`
              : 'Создайте свой первый урок, чтобы начать делиться знаниями с учениками'
            }
          </p>
          {!debouncedSearch && (
            <Link
              href="/dashboard/mentor/lessons/new"
              className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать урок
            </Link>
          )}
        </div>
      )}
    </main>
  )
}