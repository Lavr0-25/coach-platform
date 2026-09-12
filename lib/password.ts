// Единая политика паролей (решение Анатолия, 12.09): минимум 8 символов
// + блок популярных слабых паролей. Без требования спецзнаков/цифр — по NIST
// длина важнее наборов, а меньше требований = меньше брошенных регистраций.
// Подключается во всех формах с паролем: регистрация, сброс, смена в кабинете.

export const MIN_PASSWORD_LENGTH = 8

// Топ слабых паролей (ru+en) — точное совпадение в нижнем регистре
const WEAK_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  '12121212',
  '12341234',
  '12312312',
  '22222222',
  '88888888',
  'qwerty123',
  'qwertyui',
  'password',
  'password1',
  'пароль',
  'пароль123',
  'пароль2019',
  'йцукен123',
  'йцукенгшщз',
  'iloveyou',
  'admin123',
  '1q2w3e4r',
  'qazwsx123',
])

export interface PasswordCheck {
  ok: boolean
  message?: string
}

export function validatePassword(password: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов` }
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: 'Этот пароль слишком популярный и легко подбирается. Придумайте другой' }
  }
  return { ok: true }
}