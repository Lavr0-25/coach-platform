import { createHash } from 'crypto'

// Помощник Robokassa для Ф2 спеки payments.md (docs/specs/payments.md).
// Только чистые функции: URL оплаты и проверка подписи вебхука.
// Секреты — только env (ROBOKASSA_LOGIN, ROBOKASSA_PASSWORD1/2, ROBOKASSA_IS_TEST),
// в репозиторий и БД не попадают.
//
// Подписи по канону Robokassa (регистр букв MD5 — верхний):
//   ссылка оплаты: md5(`${login}:${outSum}:${invId}:${password1}`)
//   вебхук ResultURL: md5(`${outSum}:${invId}:${password2}`)
// Description в подписи НЕ участвует (пока не передаём Receipt/Email).

export function robokassaMd5(value: string): string {
  return createHash('md5').update(value, 'utf8').digest('hex').toUpperCase()
}

export function isRobokassaConfigured(): boolean {
  return Boolean(
    process.env.ROBOKASSA_LOGIN &&
    process.env.ROBOKASSA_PASSWORD1 &&
    process.env.ROBOKASSA_PASSWORD2
  )
}

// Ссылка на платёжную страницу Robokassa. isTest включён, если
// ROBOKASSA_IS_TEST не равен '0' (по умолчанию — тестовый режим).
export function buildPaymentUrl(invId: string, amount: number, description: string): string {
  const login = process.env.ROBOKASSA_LOGIN
  const password1 = process.env.ROBOKASSA_PASSWORD1
  if (!login || !password1) throw new Error('Robokassa не настроена (env)')

  const outSum = amount.toFixed(2)
  const signature = robokassaMd5(`${login}:${outSum}:${invId}:${password1}`)

  const params = new URLSearchParams({
    MerchantLogin: login,
    OutSum: outSum,
    InvId: invId,
    Description: description.slice(0, 100),
    SignatureValue: signature,
    Culture: 'ru',
  })
  if (process.env.ROBOKASSA_IS_TEST !== '0') params.set('IsTest', '1')

  return `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`
}

// Проверка подписи вебхука ResultURL. Возвращает false при любой
// нестыковке (нет секрета, нет подписи, не совпал хэш) — вызов отклоняется.
export function verifyResultSignature(
  outSum: string,
  invId: string,
  signatureValue: string | null
): boolean {
  const password2 = process.env.ROBOKASSA_PASSWORD2
  if (!password2 || !signatureValue) return false
  return robokassaMd5(`${outSum}:${invId}:${password2}`) === signatureValue.toUpperCase()
}