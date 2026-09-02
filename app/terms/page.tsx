import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Условия использования - RightWay',
  description: 'Условия использования платформы RightWay',
}

// Черновик: места с [заполнить] требуют реальных данных владельца
export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold gradient-text mb-8">Условия использования</h1>

      <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Черновик документа.</strong> Перед запуском в продакшен заполните
          реквизиты владельца (помечены <code className="bg-amber-100 px-1 rounded">[заполнить]</code>)
          и при необходимости согласуйте с юристом.
        </div>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">1. Общие положения</h2>
          <p>
            RightWay (далее — «Платформа») — сервис, позволяющий наставникам
            размещать обучающие курсы и уроки, а пользователям — проходить обучение.
            Используя Платформу, вы соглашаетесь с настоящими Условиями.
          </p>
          <p>
            Владелец Платформы: <span className="text-gray-500">[заполнить: ИП/ООО, ИНН]</span>.
            Контакт для обращений: <span className="text-gray-500">[заполнить: e-mail поддержки]</span>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">2. Регистрация и аккаунт</h2>
          <p>
            Для прохождения платных курсов и публикации материалов необходима регистрация.
            Вы отвечаете за сохранность пароля и все действия, совершённые под вашим аккаунтом.
            Пользователям младше 18 лет необходимо согласие законного представителя.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">3. Права и обязанности пользователей</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Наставник размещает только те материалы, на которые у него есть права
              (авторские уроки, лицензионный контент); он несёт ответственность за их законность.
            </li>
            <li>Запрещено размещать оскорбления, спам, материалы, нарушающие закон.</li>
            <li>
              Платформа вправе скрыть или удалить материал, нарушающий настоящие Условия,
              а также ограничить доступ нарушителю.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">4. Оплата и возвраты</h2>
          <p>
            Условия доступа к платным курсам, цены и правила возврата определяет наставник,
            публикующий курс. Платформа выступает площадкой размещения и
            <span className="text-gray-500"> [заполнить: роль платформы в расчётах — агент/посредник]</span>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">5. Интеллектуальная собственность</h2>
          <p>
            Права на курсы и уроки остаются у наставников. Права на программный код,
            дизайн и торговое обозначение Платформы принадлежат её владельцу.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">6. Изменение условий</h2>
          <p>
            Мы можем изменять настоящие Условия; актуальная версия всегда доступна на
            этой странице. Продолжение использования Платформы после изменений означает
            согласие с новой редакцией.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">7. Связанные документы</h2>
          <p>
            Обработка персональных данных описана в{' '}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
              Политике конфиденциальности
            </Link>
            .
          </p>
        </section>

        <p className="text-sm text-gray-400">Дата последнего обновления: сентябрь 2026</p>
      </div>
    </div>
  )
}