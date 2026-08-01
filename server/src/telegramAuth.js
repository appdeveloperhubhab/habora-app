import crypto from 'node:crypto'

/**
 * Проверка подлинности пользователя Telegram.
 *
 * Telegram передаёт Mini App строку `initData` — данные о том, кто открыл
 * приложение, вместе с подписью. Подпись считается по секретному токену бота,
 * который знают только Telegram и наш сервер. Поэтому подделать чужой id
 * невозможно, не зная токена.
 *
 * Алгоритм описан в документации Telegram: из всех полей, кроме самой подписи,
 * собирается строка вида `ключ=значение`, отсортированная по алфавиту и
 * склеенная переводами строк. От неё берётся HMAC-SHA256 на ключе, который сам
 * получен как HMAC-SHA256 от токена бота со словом "WebAppData".
 */

/** Максимальный возраст initData. Старые данные не принимаем — их могли перехватить. */
const MAX_AGE_SECONDS = 24 * 60 * 60

/**
 * @returns {{ ok: true, userId: number, user: object } | { ok: false, reason: string }}
 */
export function verifyInitData(initData, botToken) {
  if (!initData) return { ok: false, reason: 'initData отсутствует' }
  if (!botToken) return { ok: false, reason: 'BOT_TOKEN не задан на сервере' }

  const params = new URLSearchParams(initData)
  const providedHash = params.get('hash')
  if (!providedHash) return { ok: false, reason: 'в initData нет подписи' }

  // Сама подпись в подсчёт не входит — иначе проверить её было бы нельзя.
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Сравнение с постоянным временем: обычное `===` завершается на первом
  // несовпавшем символе, и по времени ответа можно было бы подбирать подпись.
  const provided = Buffer.from(providedHash, 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'подпись не совпадает' }
  }

  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate)) return { ok: false, reason: 'нет времени авторизации' }
  if (Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SECONDS) {
    return { ok: false, reason: 'данные авторизации устарели' }
  }

  let user
  try {
    user = JSON.parse(params.get('user') ?? 'null')
  } catch {
    return { ok: false, reason: 'не удалось разобрать данные пользователя' }
  }
  if (!user?.id) return { ok: false, reason: 'в initData нет пользователя' }

  return { ok: true, userId: user.id, user }
}
