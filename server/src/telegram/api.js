import crypto from 'node:crypto'

/**
 * Обращения к Telegram Bot API.
 *
 * Отдельного пакета для бота нет намеренно: нужны четыре метода, и каждый —
 * это обычный POST с JSON. Библиотека принесла бы с собой свой жизненный цикл,
 * своё поведение при ошибках и десяток зависимостей ради того же самого.
 */

/** Подменяется в тестах: настоящий Telegram из них дёргать нельзя. */
const API_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'

/**
 * Общий секрет с Telegram: он присылает его в заголовке каждого уведомления,
 * и по нему мы отличаем настоящий вызов от постороннего, нашедшего адрес.
 *
 * Выводится из токена бота, а не задаётся отдельно: лишняя переменная
 * окружения — это ещё одно место, где можно ошибиться при настройке, а
 * секретность здесь ровно та же.
 */
export function webhookSecret(botToken) {
  return crypto.createHash('sha256').update(`${botToken}:habora-webhook`).digest('hex').slice(0, 32)
}

/**
 * Вызов метода Bot API.
 *
 * Ошибки не выбрасываются наружу: рассылка идёт по всем подряд, и человек,
 * заблокировавший бота, не должен обрывать её на середине. Наверх уходит
 * `{ ok: false }`, а решает вызывающий.
 */
async function call(method, payload) {
  const token = process.env.BOT_TOKEN
  if (!token) return { ok: false, description: 'BOT_TOKEN не задан' }

  try {
    const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return await response.json()
  } catch (error) {
    return { ok: false, description: String(error) }
  }
}

/** Кнопка, открывающая мини-приложение прямо в Telegram. */
export function webAppButton(text, url) {
  return [[{ text, web_app: { url } }]]
}

export function sendMessage(chatId, text, replyMarkup) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: { inline_keyboard: replyMarkup } } : {}),
  })
}

export function editMessageText(chatId, messageId, text, replyMarkup) {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    // Пустой список убирает кнопки: после отметки нажимать уже нечего.
    reply_markup: { inline_keyboard: replyMarkup ?? [] },
  })
}

/**
 * Ответ на нажатие кнопки. Telegram ждёт его в течение нескольких секунд:
 * без ответа у пользователя на кнопке крутится часик, пока не истечёт время.
 */
export function answerCallback(callbackId, text) {
  return call('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) })
}

export function setWebhook(url, secret) {
  return call('setWebhook', {
    url,
    secret_token: secret,
    // Остальные типы событий нам не нужны, а каждое лишнее — это разбудить
    // спящий сервер впустую.
    allowed_updates: ['message', 'callback_query'],
  })
}
