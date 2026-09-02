import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности - CoachPlatform',
  description: 'Политика конфиденциальности платформы CoachPlatform',
}

// Черновик: места с [заполнить] требуют реальных данных владельца
export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold gradient-text mb-8">Политика конфиденциальности</h1>

      <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Черновик документа.</strong> Перед запуском в продакшен заполните
          реквизиты владельца (помечены <code className="bg-amber-100 px-1 rounded">[заполнить]</code>)
          и при необходимости согласуйте с юристом.
        </div>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">1. Какие данные мы собираем</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>При регистрации:</strong> e-mail, имя (отображаемое), пароль
              (хранится только в виде необратимой криптографической записи).
            </li>
            <li>
              <strong>При работе с Платформой:</strong> созданные курсы и уроки,
              комментарии, подписки, избранное, история сообщений.
            </li>
            <li>
              <strong>Технические данные:</strong> сведения о сессии входа, необходимые
              для безопасности аккаунта.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">2. Зачем мы их используем</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>обеспечить работу аккаунта, курсов, комментариев и сообщений;</li>
            <li>показывать наставникам аналитику по их материалам;</li>
            <li>модерировать контент и предотвращать злоупотребления;</li>
            <li>отвечать на обращения в поддержку.</li>
          </ul>
          <p className="mt-2">
            Мы не продаём персональные данные третьим лицам.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">3. Кто обрабатывает данные</h2>
          <p>
            Хранение и обработку данных обеспечивает поставщик инфраструктуры Supabase
            (база данных, авторизация, хранение файлов).
            Владелец Платформы: <span className="text-gray-500">[заполнить: ИП/ООО, ИНН]</span>.
            Контакт для запросов к персональным данным:{' '}
            <span className="text-gray-500">[заполнить: e-mail]</span>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">4. Сроки хранения и удаление</h2>
          <p>
            Данные хранятся, пока существует аккаунт. Вы можете запросить удаление
            аккаунта и связанных данных по адресу <span className="text-gray-500">[заполнить: e-mail]</span>.
            Часть данных может сохраняться в резервных копиях ограниченное время.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">5. Cookies</h2>
          <p>
            Платформа использует только функциональные cookies (сессия входа),
            необходимые для работы сервиса. Аналитические и рекламные cookie не используются.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">6. Безопасность</h2>
          <p>
            Доступ к данным защищён правилами доступа на уровне строк базы данных
            (RLS): пользователи видят и изменяют только свои данные и публичный
            контент. Пароли и токены сессий не доступны другим пользователям.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">7. Связанные документы</h2>
          <p>
            Правила пользования Платформой описаны в{' '}
            <Link href="/terms" className="text-blue-600 hover:text-blue-700">
              Условиях использования
            </Link>
            .
          </p>
        </section>

        <p className="text-sm text-gray-400">Дата последнего обновления: сентябрь 2026</p>
      </div>
    </div>
  )
}