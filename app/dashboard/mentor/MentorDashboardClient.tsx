'use client'

import { useState } from 'react'
import Link from 'next/link'

interface MentorDashboardClientProps {
  myLessons: any[]
  favorites: any[]
  inProgress: any[]
  completed: any[]
  purchases: any[]
}

export default function MentorDashboardClient({
  myLessons = [],
  favorites = [],
  inProgress = [],
  completed = [],
  purchases = [],
}: MentorDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('teaching')

  const tabs = [
    { id: 'teaching', label: 'Мои уроки', icon: '' },
    { id: 'learning', label: 'Моё обучение', icon: '' },
  ]

  return (
    <>
      {/* Две большие вкладки */}
      <div className="bg-white rounded-xl shadow-sm border p-2 mb-6">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-2xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {/* ВКЛАДКА 1: Мои уроки (преподаватель) */}
        {activeTab === 'teaching' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-blue-600">📚</span> Мои уроки
              </h2>
              <Link
                href="/dashboard/mentor/lessons"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Все уроки →
              </Link>
            </div>
            
            {myLessons.length > 0 ? (
              <>
                <div className="space-y-3 mb-8">
                  {myLessons.slice(0, 3).map((lesson) => (
                    <div key={lesson.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{lesson.title}</h3>
                          <p className="text-sm text-gray-500">
                            Создан {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-200 text-sm"
                          >
                            Просмотр
                          </Link>
                          <Link
                            href={`/dashboard/mentor/lessons/${lesson.id}/edit`}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 text-sm"
                          >
                            Редактировать
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {myLessons.length > 3 && (
                  <div className="text-center mb-6">
                    <Link
                      href="/dashboard/mentor/lessons"
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Показать все {myLessons.length} уроков →
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-lg mb-4">У вас пока нет уроков</p>
                <Link
                  href="/dashboard/mentor/lessons/new"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 inline-block"
                >
                  + Создать первый урок
                </Link>
              </div>
            )}

            {/* Быстрые действия */}
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Быстрые действия</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/dashboard/mentor/lessons/new"
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors text-center"
                >
                  <div className="text-3xl mb-2"></div>
                  <div className="font-medium text-gray-900">Создать урок</div>
                </Link>
                <Link
                  href="/dashboard/mentor/lessons"
                  className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors text-center"
                >
                  <div className="text-3xl mb-2">📋</div>
                  <div className="font-medium text-gray-900">Управление уроками</div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 2: Моё обучение (студент) */}
        {activeTab === 'learning' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="text-purple-600"></span> Моё обучение
            </h2>

            {/* Статистика */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-1">{favorites.length}</div>
                <div className="text-sm text-gray-600">⭐ Избранное</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">{inProgress.length}</div>
                <div className="text-sm text-gray-600">📖 В процессе</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">{completed.length}</div>
                <div className="text-sm text-gray-600">✅ Завершено</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">{purchases.length}</div>
                <div className="text-sm text-gray-600">💳 Покупки</div>
              </div>
            </div>

            {/* Избранное */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-yellow-600">⭐</span> Избранное
                </h3>
                {favorites.length > 3 && (
                  <span className="text-sm text-gray-500">Показано 3 из {favorites.length}</span>
                )}
              </div>
              
              {favorites.length > 0 ? (
                <div className="space-y-3">
                  {favorites.slice(0, 3).map((fav) => {
                    const lesson = fav.lessons
                    if (!lesson) return null

                    return (
                      <div key={fav.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{lesson.title}</h4>
                            {fav.group_name && (
                              <p className="text-sm text-gray-500">Группа: {fav.group_name}</p>
                            )}
                          </div>
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm"
                          >
                            Смотреть
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="mb-2">У вас пока нет избранных уроков</p>
                  <Link
                    href="/catalog"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Перейти в каталог →
                  </Link>
                </div>
              )}
            </div>

            {/* В процессе изучения */}
            {inProgress.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-orange-600">📖</span> В процессе изучения
                </h3>
                <div className="space-y-3">
                  {inProgress.slice(0, 3).map((progress) => {
                    const lesson = progress.lessons
                    if (!lesson) return null

                    return (
                      <div key={progress.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">{lesson.title}</h4>
                            <div className="flex items-center gap-4">
                              <div className="flex-1 max-w-xs">
                                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                                  <span>Прогресс</span>
                                  <span>{progress.progress_percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-orange-600 h-2 rounded-full"
                                    style={{ width: `${progress.progress_percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 text-sm ml-4"
                          >
                            Продолжить
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Завершено */}
            {completed.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-green-600">✅</span> Завершено
                </h3>
                <div className="space-y-3">
                  {completed.slice(0, 3).map((progress) => {
                    const lesson = progress.lessons
                    if (!lesson) return null

                    return (
                      <div key={progress.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-green-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{lesson.title}</h4>
                            <p className="text-sm text-gray-500">
                              Завершено {new Date(progress.last_watched_at).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 text-sm"
                          >
                            Повторить
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Мои покупки */}
            {purchases.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-purple-600">💳</span> Мои покупки
                </h3>
                <div className="space-y-3">
                  {purchases.slice(0, 3).map((purchase) => {
                    const lesson = purchase.lessons
                    if (!lesson) return null

                    return (
                      <div key={purchase.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{lesson.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span>📅 {new Date(purchase.purchased_at).toLocaleDateString('ru-RU')}</span>
                              <span>💰 {purchase.amount} ₽</span>
                            </div>
                          </div>
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm"
                          >
                            Смотреть
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Если всё пусто */}
            {favorites.length === 0 && inProgress.length === 0 && completed.length === 0 && purchases.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">🎓</div>
                <p className="text-lg mb-4">Вы ещё не начали обучение</p>
                <Link
                  href="/catalog"
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 inline-block"
                >
                  Перейти в каталог уроков
                </Link>
              </div>
            )}

            {/* Кнопка перейти в каталог */}
            <div className="mt-8 pt-6 border-t text-center">
              <Link
                href="/catalog"
                className="bg-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors inline-block"
              >
                🔍 Найти уроки для изучения
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}