'use client'

import { useState } from 'react'
import Link from 'next/link'

interface MentorDashboardClientProps {
  coachId: string
  myLessons: any[]
  favorites: any[]
  inProgress: any[]
  completed: any[]
  purchases: any[]
}

export default function MentorDashboardClient({
  coachId,
  myLessons = [],
  favorites = [],
  inProgress = [],
  completed = [],
  purchases = [],
}: MentorDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('teaching')

  const tabs = [
    { id: 'teaching', label: 'Мои уроки', icon: '', count: myLessons.length },
    { id: 'learning', label: 'Моё обучение', icon: '', count: favorites.length + inProgress.length + completed.length },
  ]

  return (
    <div className="space-y-6">
      {/* Вкладки */}
      <div className="style-card p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === tab.id
                  ? 'gradient-btn text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white text-gray-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-purple-100 text-purple-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'teaching' && (
        <div className="space-y-6">
          {/* Заголовок */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold gradient-text flex items-center gap-2">
              <span className="gradient-icon w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg">📚</span>
              Мои уроки
            </h2>
            <Link
              href="/dashboard/mentor/lessons"
              className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1 group"
            >
              Все уроки
              <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Список уроков */}
          {myLessons.length > 0 ? (
            <div className="space-y-3">
              {myLessons.slice(0, 5).map((lesson) => (
                <div key={lesson.id} className="style-card p-4 sm:p-5 hover:shadow-md transition-all border border-purple-100 group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 mb-1 truncate group-hover:text-purple-600 transition-colors">
                        {lesson.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                        </span>
                        {lesson.price > 0 && !lesson.is_free_preview && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {lesson.price} ₽
                          </span>
                        )}
                        {lesson.is_free_preview && (
                          <span className="text-green-600 font-medium"> Бесплатный превью</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="gradient-btn text-white px-4 py-2 rounded-lg font-medium text-sm shadow-lg shadow-purple-500/20"
                      >
                        Просмотр
                      </Link>
                      <Link
                        href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                        className="bg-white text-purple-700 border border-purple-200 px-4 py-2 rounded-lg font-medium text-sm hover:bg-purple-50 transition-all"
                      >
                        Редактировать
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {myLessons.length > 5 && (
                <div className="text-center pt-4">
                  <Link
                    href="/dashboard/mentor/lessons"
                    className="text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    Показать все {myLessons.length} уроков →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon="📚"
              title="У вас пока нет уроков"
              description="Создайте свой первый урок, чтобы начать делиться знаниями с учениками!"
              actionLink="/dashboard/mentor/lessons/new"
              actionText="Создать первый урок"
            />
          )}

          {/* Быстрые действия */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-purple-100">
            <Link
              href="/dashboard/mentor/lessons/new"
              className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                  
                </div>
                <div>
                  <div className="font-bold text-gray-900">Создать урок</div>
                  <div className="text-sm text-gray-500">Добавить новый материал</div>
                </div>
              </div>
            </Link>
            <Link
              href="/dashboard/mentor/lessons"
              className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 gradient-icon rounded-xl flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                  
                </div>
                <div>
                  <div className="font-bold text-gray-900">Управление уроками</div>
                  <div className="text-sm text-gray-500">Все ваши материалы</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ВКЛАДКА 2: Моё обучение */}
      {activeTab === 'learning' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <span className="gradient-icon w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"></span>
            Моё обучение
          </h2>

          {/* Статистика */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon="⭐"
              value={favorites.length}
              label="Избранное"
              gradient="from-yellow-400 to-orange-500"
            />
            <StatCard
              icon="📖"
              value={inProgress.length}
              label="В процессе"
              gradient="from-orange-400 to-red-500"
            />
            <StatCard
              icon="✅"
              value={completed.length}
              label="Завершено"
              gradient="from-green-400 to-emerald-500"
            />
            <StatCard
              icon="💳"
              value={purchases.length}
              label="Покупки"
              gradient="from-purple-400 to-pink-500"
            />
          </div>

          {/* Избранное */}
          {favorites.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-yellow-500">⭐</span> Избранное
                </h3>
                {favorites.length > 3 && (
                  <span className="text-sm text-gray-500">Показано 3 из {favorites.length}</span>
                )}
              </div>
              
              {favorites.slice(0, 3).map((fav: any) => {
                const lesson = fav.lessons
                if (!lesson) return null

                return (
                  <div key={fav.id} className="style-card p-4 sm:p-5 hover:shadow-md transition-all border border-purple-100 bg-gradient-to-br from-yellow-50/50 to-orange-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 mb-1 truncate">{lesson.title}</h4>
                        {fav.group_name && (
                          <p className="text-sm text-gray-500">Группа: {fav.group_name}</p>
                        )}
                      </div>
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="gradient-btn text-white px-5 py-2 rounded-lg font-medium text-sm shadow-lg shadow-purple-500/20"
                      >
                        Смотреть
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* В процессе */}
          {inProgress.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-orange-500">📖</span> В процессе изучения
              </h3>
              
              {inProgress.slice(0, 3).map((progress: any) => {
                const lesson = progress.lessons
                if (!lesson) return null

                return (
                  <div key={progress.id} className="style-card p-4 sm:p-5 hover:shadow-md transition-all border border-purple-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 w-full">
                        <h4 className="font-bold text-gray-900 mb-3 truncate">{lesson.title}</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Прогресс</span>
                            <span className="font-bold text-orange-600">{progress.progress_percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all"
                              style={{ width: `${progress.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="gradient-btn text-white px-5 py-2 rounded-lg font-medium text-sm shadow-lg shadow-purple-500/20 sm:flex-shrink-0"
                      >
                        Продолжить
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Завершено */}
          {completed.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-green-500">✅</span> Завершено
              </h3>
              
              {completed.slice(0, 3).map((progress: any) => {
                const lesson = progress.lessons
                if (!lesson) return null

                return (
                  <div key={progress.id} className="style-card p-4 sm:p-5 hover:shadow-md transition-all border border-purple-100 bg-gradient-to-br from-green-50/50 to-emerald-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 mb-1 truncate">{lesson.title}</h4>
                        <p className="text-sm text-gray-500">
                          Завершено {new Date(progress.last_watched_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="bg-white text-gray-700 border border-purple-200 px-5 py-2 rounded-lg font-medium text-sm hover:bg-purple-50 transition-all"
                      >
                        Повторить
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Покупки */}
          {purchases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-purple-500"></span> Мои покупки
              </h3>
              
              {purchases.slice(0, 3).map((purchase: any) => {
                const lesson = purchase.lessons
                if (!lesson) return null

                return (
                  <div key={purchase.id} className="style-card p-4 sm:p-5 hover:shadow-md transition-all border border-purple-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 mb-2 truncate">{lesson.title}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(purchase.purchased_at).toLocaleDateString('ru-RU')}
                          </span>
                          <span className="font-bold text-purple-600">{purchase.amount} ₽</span>
                        </div>
                      </div>
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="gradient-btn text-white px-5 py-2 rounded-lg font-medium text-sm shadow-lg shadow-purple-500/20"
                      >
                        Смотреть
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Если всё пусто */}
          {favorites.length === 0 && inProgress.length === 0 && completed.length === 0 && purchases.length === 0 && (
            <EmptyState
              icon=""
              title="Вы ещё не начали обучение"
              description="Найдите интересные уроки на главной странице и начните свой путь к новым знаниям!"
              actionLink="/"
              actionText="Перейти на главную"
            />
          )}

          {/* Кнопка на главную */}
          <div className="text-center pt-6 border-t border-purple-100">
            <Link
              href="/"
              className="gradient-btn text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Найти уроки для изучения
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// Вспомогательные компоненты

function StatCard({ icon, value, label, gradient }: any) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 text-white shadow-lg`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm opacity-90">{label}</div>
    </div>
  )
}

function EmptyState({ icon, title, description, actionLink, actionText }: any) {
  return (
    <div className="style-card p-12 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      {actionLink && actionText && (
        <Link href={actionLink} className="gradient-btn text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 inline-block">
          {actionText}
        </Link>
      )}
    </div>
  )
}