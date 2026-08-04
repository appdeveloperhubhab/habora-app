import { db } from '../db.js'
import { answerCallback, editMessageText, sendMessage, webAppButton, webhookSecret } from '../telegram/api.js'
import { escapeHtml, texts } from '../telegram/messages.js'
import { pendingHabits, runReminderTick, weekdayOf } from '../telegram/reminders.js'

/**
 * Приём событий из Telegram и будильник рассылки.
 *
 * Эти маршруты живут вне `/api/`: там стоит проверка подписи мини-приложения,
 * а сюда стучится не приложение, а сам Telegram — своей подписи у него нет.
 * Вместо неё общий секрет: у уведомлений он в заголовке, у будильника — в
 * адресе, потому что сторонние сервисы умеют звать только по ссылке.
 */
export async function botRoutes(app) {
  const webAppUrl = process.env.WEBAPP_URL ?? process.env.ALLOWED_ORIGIN ?? ''

  app.post('/bot/webhook', async (request, reply) => {
    const expected = webhookSecret(process.env.BOT_TOKEN ?? '')
    if (request.headers['x-telegram-bot-api-secret-token'] !== expected) {
      return reply.code(401).send({ error: 'Неверный секрет' })
    }

    // Отвечаем сразу: Telegram ждёт ответа несколько секунд и повторяет
    // уведомление, если не дождался. Обработка идёт уже после ответа.
    void handleUpdate(request.body ?? {}, webAppUrl).catch((error) => {
      request.log.error({ error }, 'не удалось обработать событие Telegram')
    })

    return { ok: true }
  })

  app.get('/bot/tick/:secret', async (request, reply) => {
    if (request.params.secret !== webhookSecret(process.env.BOT_TOKEN ?? '')) {
      return reply.code(401).send({ error: 'Неверный секрет' })
    }
    return runReminderTick(webAppUrl)
  })
}

async function handleUpdate(update, webAppUrl) {
  if (update.message) return handleMessage(update.message, webAppUrl)
  if (update.callback_query) return handleCallback(update.callback_query, webAppUrl)
}

/**
 * Сообщение боту. Разговаривать он не умеет и не должен: всё живёт в
 * приложении, а бот — дверь к нему и напоминание.
 */
async function handleMessage(message, webAppUrl) {
  const from = message.from
  if (!from?.id || message.chat?.type !== 'private') return

  const t = texts(from.language_code)
  const now = new Date().toISOString()

  /*
   * «Старт» — единственный момент, когда Telegram разрешает боту начать
   * переписку. Отмечаем его: без этой отметки напоминания слать некому.
   *
   * Человек мог сначала открыть приложение и только потом нажать «Старт»,
   * а мог наоборот — поэтому не просто UPDATE, а вставка с обновлением.
   */
  await db.execute({
    sql: `INSERT INTO users (user_id, first_name, username, language, first_seen, last_seen, opens, chat_started)
          VALUES (?, ?, ?, ?, ?, ?, 0, 1)
          ON CONFLICT (user_id) DO UPDATE SET
            first_name   = excluded.first_name,
            username     = excluded.username,
            language     = excluded.language,
            chat_started = 1`,
    args: [from.id, from.first_name ?? '', from.username ?? null, from.language_code ?? null, now, now],
  })

  const text = message.text ?? ''
  if (text.startsWith('/start')) {
    await sendMessage(from.id, t.welcome(escapeHtml(from.first_name ?? '')), webAppButton(t.open, webAppUrl))
    return
  }

  await sendMessage(from.id, t.unknown, webAppButton(t.open, webAppUrl))
}

/**
 * Нажатие кнопки под напоминанием: отметить привычку, не открывая приложение.
 * Данные кнопки — `d:<id привычки>:<дата>`.
 */
async function handleCallback(query, webAppUrl) {
  const t = texts(query.from?.language_code)
  const [kind, habitId, date] = String(query.data ?? '').split(':')

  if (kind !== 'd' || !habitId || !date) {
    await answerCallback(query.id)
    return
  }

  // Нажавший обязан быть участником привычки: данные кнопки приходят от клиента
  // и подделываются, а `from.id` заверен самим Telegram.
  const { rows } = await db.execute({
    sql: `SELECT h.id, h.name
            FROM habit_members m
            JOIN habits h ON h.id = m.habit_id
           WHERE h.id = ? AND m.user_id = ?`,
    args: [habitId, query.from.id],
  })
  const habit = rows[0]
  if (!habit) {
    await answerCallback(query.id, t.goneToast)
    return
  }

  // Именно вставка, а не переключение: кнопка называется «отметить», и
  // повторное нажатие не должно снимать отметку, поставленную секунду назад.
  await db.execute({
    sql: 'INSERT OR IGNORE INTO entries (user_id, habit_id, date) VALUES (?, ?, ?)',
    args: [query.from.id, habitId, date],
  })


  await answerCallback(query.id, t.markedToast)

  const message = query.message
  if (!message) return

  // Тот же отбор, что и в самом напоминании: привычки не на сегодня в списке
  // оставшихся не место — их и не предлагали отмечать.
  const left = await pendingHabits(query.from.id, date, weekdayOf(date))

  // Сообщение переписывается под новое состояние: кнопка уже нажата, и
  // оставлять прежний список — значит предлагать отметить отмеченное.
  const buttons = left.map((row) => [{ text: `✓ ${row.name}`, callback_data: `d:${row.id}:${date}` }])
  buttons.push([{ text: t.open, web_app: { url: webAppUrl } }])

  const text = left.length === 0 ? t.allDone : t.markedOne(escapeHtml(habit.name))
  await editMessageText(message.chat.id, message.message_id, text, left.length === 0 ? [] : buttons)
}
