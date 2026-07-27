'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FavoriteButton from '@/components/FavoriteButton'

interface Course {
  id: string
  title: string
  description: string | null
  price: number
  cover_image: string | null
  is_published: boolean
  created_at: string
  lessons?: { id: string }[]
}

interface Lesson {
  id: string
  title: string
  description: string | null
  price: number
  is_free_preview: boolean
  created_at: string
  cover_image: string | null
}

interface Coach {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  specialization: string | null
  created_at: string
}

export default function MentorPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('')
  const [coach, setCoach] = useState<Coach | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [uniqueStudents, setUniqueStudents] = useState(0)
  const [experienceYears, setExperienceYears] = useState(0)
  const [totalLessonsCount, setTotalLessonsCount] = useState(0) // 🔥 Новое: все уроки автора

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return

    const loadData = async () => {
      const supabase = createClient()
      
      // Получаем данные автора
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id, user_id, display_name, avatar_url, bio, specialization, created_at')
        .eq('id', id)
        .single()

      if (!coachData) {
        notFound()
        return
      }

      setCoach(coachData)

      // Рассчитываем опыт
      const years = Math.floor((new Date().getTime() - new Date(coachData.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      setExperienceYears(years)

      // Получаем курсы
      const { data: coursesData } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          price,
          cover_image,
          is_published,
          created_at,
          lessons(id)
        `)
        .eq('coach_id', coachData.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      setCourses(coursesData || [])

      // Получаем отдельные уроки (не входящие в курсы)
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, title, description, price, is_free_preview, created_at, cover_image')
        .eq('coach_id', coachData.id)
        .is('course_id', null)
        .order('created_at', { ascending: false })

      setLessons(lessonsData || [])

      // 🔥 Подсчёт ВСЕХ уроков автора (включая те, что в курсах)
      const { data: allLessonsData } = await supabase
        .from('lessons')
        .select('id')
        .eq('coach_id', coachData.id)

      const lessonsInCourses = coursesData?.reduce((sum, c) => sum + (c.lessons?.length || 0), 0) || 0
      const standaloneLessons = lessonsData?.length || 0
      const allLessonsTotal = allLessonsData?.length || 0
      
      // Используем прямой подсчёт из БД (надёжнее)
      setTotalLessonsCount(allLessonsTotal)

      // Считаем уникальных студентов
      const allLessonIds = [
        ...(coursesData?.flatMap(c => c.lessons || []) || []),
        ...(lessonsData || [])
      ].map(l => l.id)

      if (allLessonIds.length > 0) {
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('user_id', { count: 'exact' })
          .in('lesson_id', allLessonIds)

        const uniqueIds = new Set(progressData?.map(p => p.user_id) || [])
        setUniqueStudents(uniqueIds.size)
      } else {
        setUniqueStudents(0)
      }

      setLoading(false)
    }

    loadData()
  }, [id])

  // Debounce для поиска (300ms)
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

  // Фильтрация курсов и уроков
  const filteredCourses = debouncedSearch
    ? courses.filter(c => c.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         (c.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) || false))
    : courses

  const filteredLessons = debouncedSearch
    ? lessons.filter(l => l.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         (l.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) || false))
    : lessons

  const getInitials = (name?: string | null) => {
    if (!name) return 'A'
    const parts = name.split(' ')
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  //  Склонение слова "урок"
  const getLessonsWord = (count: number) => {
    if (count === 1) return 'урок'
    if (count < 5) return 'урока'
    return 'уроков'
  }

  const getCoursesWord = (count: number) => {
    if (count === 1) return 'курс'
    if (count < 5) return 'курса'
    return 'курсов'
  }

  const getStudentsWord = (count: number) => {
    if (count === 1) return 'подписчик'
    if (count < 5) return 'подписчика'
    return 'подписчиков'
  }

  if (loading || !coach) {
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
      {/* Кнопка назад */}
      <div className="mb-6">
        <Link href="/mentors" className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-2 transition-colors group">
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к авторам
        </Link>
      </div>

      {/* Профиль автора */}
      <div className="style-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          {/* Аватар */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              {coach.avatar_url ? (
                <img src={coach.avatar_url} alt={coach.display_name || ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl sm:text-6xl font-bold text-purple-600">
                  {getInitials(coach.display_name)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            {/* Имя и специализация */}
            <div className="mb-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                {coach.display_name || 'Автор'}
              </h1>
              {coach.specialization && (
                <p className="text-lg text-purple-600 font-medium">{coach.specialization}</p>
              )}
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{courses.length}</div>
                <div className="text-sm text-gray-600">
                  {getCoursesWord(courses.length)}
                </div>
              </div>
              {/* 🔥 Теперь показываем ВСЕ уроки автора */}
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{totalLessonsCount}</div>
                <div className="text-sm text-gray-600">
                  {getLessonsWord(totalLessonsCount)}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{uniqueStudents}</div>
                <div className="text-sm text-gray-600">
                  {getStudentsWord(uniqueStudents)}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{experienceYears}+</div>
                <div className="text-sm text-gray-600">лет на платформе</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Раздел "Об Авторе" */}
      {coach.bio && (
        <div className="style-card p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"></span>
            Об авторе
          </h2>
          <div className="prose prose-purple max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
          </div>
          
          {experienceYears > 0 && (
            <div className="mt-6 flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
              <div className="w-12 h-12 gradient-icon rounded-lg flex items-center justify-center text-white text-2xl">
                
              </div>
              <div>
                <div className="font-semibold text-gray-900">Опыт работы на платформе</div>
                <div className="text-sm text-gray-600">{experienceYears}+ лет создаю обучающие материалы</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Поиск */}
      <div className="mb-8">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по курсам и урокам автора..."
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
          <div className="mt-3">
            <p className="text-sm text-gray-600">
              Найдено: <span className="font-bold text-purple-700">{filteredCourses.length + filteredLessons.length}</span> материалов
            </p>
          </div>
        )}
      </div>

      {/* Курсы автора */}
      {filteredCourses.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">📚</span>
            Курсы автора
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const courseLessonsCount = course.lessons?.length || 0
              
              return (
                <div key={course.id} className="style-card overflow-hidden hover:shadow-lg transition-all group border border-purple-100">
                  <Link href={`/course/${course.id}`} className="block">
                    {/* Обложка с кнопкой избранного внизу */}
                    <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 relative overflow-hidden">
                      {course.cover_image ? (
                        <img 
                          src={course.cover_image} 
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-6xl opacity-50"></div>
                      )}
                      
                      {/* Цена — ВЕРХНИЙ ПРАВЫЙ УГОЛ */}
                      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                        {course.price === 0 ? 'Бесплатно' : `${course.price} ₽`}
                      </div>

                      {/* Кнопка избранного — НИЖНИЙ ЛЕВЫЙ УГОЛ */}
                      <div className="absolute bottom-3 left-3 z-10">
                        <FavoriteButton itemId={course.id} itemType="course" size="sm" />
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                        {course.title}
                      </h3>

                      {course.description && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {course.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-purple-100">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>📖</span>
                          <span>
                            {courseLessonsCount} {getLessonsWord(courseLessonsCount)}
                          </span>
                        </div>
                        
                        <div className="text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Подробнее 
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Отдельные уроки автора */}
      {filteredLessons.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <span className="gradient-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"></span>
            Отдельные уроки
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map((lesson) => {
              return (
                <div key={lesson.id} className="style-card p-5 hover:shadow-lg transition-all group border border-purple-100">
                  <Link href={`/lesson/${lesson.id}`} className="block">
                    {/* Обложка с кнопкой избранного внизу */}
                    <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl mb-4 flex items-center justify-center text-white text-4xl overflow-hidden relative">
                      {lesson.cover_image ? (
                        <img 
                          src={lesson.cover_image} 
                          alt={lesson.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="opacity-50"></span>
                      )}

                      {/* Кнопка избранного — НИЖНИЙ ЛЕВЫЙ УГОЛ */}
                      <div className="absolute bottom-3 left-3 z-10">
                        <FavoriteButton itemId={lesson.id} itemType="lesson" size="sm" />
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {lesson.title}
                    </h3>
                    
                    {lesson.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {lesson.description}
                      </p>
                    )}

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
                        Подробнее
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Если ничего не найдено */}
      {(filteredCourses.length === 0 && filteredLessons.length === 0) && (
        <div className="style-card p-12 text-center">
          <div className="text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {debouncedSearch ? 'Ничего не найдено' : 'Пока нет материалов'}
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            {debouncedSearch 
              ? `По запросу "${debouncedSearch}" материалов не найдено.`
              : 'Автор пока не добавил курсы или уроки'
            }
          </p>
        </div>
      )}
    </main>
  )
}