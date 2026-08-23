import { db, isBlocked } from '../db.js'
import {
  answerCallback,
  editMessageText,
  sendMessage,
  sendPhoto,
  webAppButton,
  webhookSecret,
} from '../telegram/api.js'
import { escapeHtml, texts } from '../telegram/messages.js'
import { habitLines, pendingHabits, runReminderTick, weekdayOf } from '../telegram/reminders.js'
import { notifyPartnersMarked } from '../telegram/partners.js'

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
  /*
   * Закрытому доступу бот не отвечает вовсе: «Старт» ничего не делает, кнопки
   * молчат. Запретить человеку написать боту нельзя — Telegram такого не
   * умеет, — но обслуживать написанное мы не обязаны.
   *
   * Молча, без объяснения: сказать «вы заблокированы» — значит позвать спорить
   * там, где спорить не с кем. Вторая дверь — вход в приложение, в index.js.
   */
  const from = update.message?.from ?? update.callback_query?.from
  if (from?.id && (await isBlocked(from.id))) return

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
    // «/start join_<привычка>» — переход по ссылке-приглашению. Telegram
    // отдаёт то, что было в ссылке, вторым словом команды.
    const payload = text.slice('/start'.length).trim()
    if (payload.startsWith('join_')) {
      await handleJoin(from, payload.slice('join_'.length), webAppUrl)
      return
    }

    await sendWelcome(from, t, webAppUrl)
    return
  }

  await sendMessage(from.id, t.unknown, webAppButton(t.open, webAppUrl))
}

/**
 * Приветствие после «Старт»: картинка с подписью и кнопкой.
 *
 * Картинка лежит рядом с самим приложением, поэтому её адрес выводится из
 * адреса приложения — отдельной настройки не нужно, а значит нет и места,
 * где её можно забыть задать.
 *
 * Если картинку отправить не вышло — шлём то же приветствие текстом. Причин
 * может быть две: приложение ещё не выложено с новой картинкой, или Telegram
 * не смог её скачать. И в том, и в другом случае человек, впервые открывший
 * бота, должен получить приветствие, а не молчание.
 */
async function sendWelcome(from, t, webAppUrl) {
  const caption = t.welcome(escapeHtml(from.first_name ?? ''))
  const buttons = webAppButton(t.open, webAppUrl)

  if (webAppUrl) {
    const photo = `${webAppUrl.replace(/\/+$/, '')}/welcome.png`
    const sent = await sendPhoto(from.id, photo, caption, buttons)
    if (sent?.ok) return
  }

  await sendMessage(from.id, caption, buttons)
}

/**
 * Переход по ссылке-приглашению.
 *
 * Присоединяем сразу, без экрана «принять или отклонить»: переход по ссылке
 * и есть согласие, а лишний шаг между желанием и результатом ничего не
 * защищает — выйти из привычки можно одним касанием.
 */
async function handleJoin(from, habitId, webAppUrl) {
  const t = texts(from.language_code)

  const { rows } = await db.execute({
    sql: `SELECT h.name, h.user_id AS owner_id, u.first_name AS owner_name
            FROM habits h
            LEFT JOIN users u ON u.user_id = h.user_id
           WHERE h.id = ?`,
    args: [habitId],
  })
  const habit = rows[0]
  if (!habit) {
    await sendMessage(from.id, t.joinGone, webAppButton(t.open, webAppUrl))
    return
  }

  const already = await db.execute({
    sql: 'SELECT 1 FROM habit_members WHERE habit_id = ? AND user_id = ?',
    args: [habitId, from.id],
  })
  if (already.rows[0]) {
    await sendMessage(from.id, t.joinedAlready(escapeHtml(habit.name)), webAppButton(t.open, webAppUrl))
    return
  }

  // Привычка встаёт в конец его собственного списка.
  const { rows: order } = await db.execute({
    sql: 'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM habit_members WHERE user_id = ?',
    args: [from.id],
  })

  await db.execute({
    sql: `INSERT OR IGNORE INTO habit_members (habit_id, user_id, sort_order, joined_at)
          VALUES (?, ?, ?, ?)`,
    args: [habitId, from.id, order[0].next, new Date().toISOString()],
  })

  await sendMessage(
    from.id,
    t.joined(escapeHtml(habit.name), escapeHtml(habit.owner_name ?? '')),
    webAppButton(t.open, webAppUrl),
  )

  /*
   * Хозяину — весть о том, что его позвали не зря. Это и есть тот момент,
   * ради которого совместные привычки затевались: пока никто не узнал, что
   * друг присоединился, совместность существует только в базе.
   */
  if (Number(habit.owner_id) !== Number(from.id)) {
    const owner = await db.execute({
      sql: 'SELECT language, chat_started FROM users WHERE user_id = ?',
      args: [habit.owner_id],
    })
    if (owner.rows[0]?.chat_started === 1) {
      const ownerTexts = texts(owner.rows[0].language)
      await sendMessage(
        habit.owner_id,
        ownerTexts.someoneJoined(escapeHtml(from.first_name ?? ''), escapeHtml(habit.name)),
        webAppButton(ownerTexts.open, webAppUrl),
      )
    }
  }
}

/**
 * Нажатие кнопки под напоминанием: отметить привычку, не открывая приложение.
 *
 * Данные кнопки — `<вид>:<id привычки>:<дата>`, где вид говорит, под каким
 * напоминанием стояла кнопка: `d` — под вечерним списком, `t` — под
 * напоминанием о назначенном часе. От него зависит, во что превратится
 * сообщение после нажатия.
 */
async function handleCallback(query, webAppUrl) {
  const t = texts(query.from?.language_code)
  const [kind, habitId, date] = String(query.data ?? '').split(':')

  if ((kind !== 'd' && kind !== 't') || !habitId || !date) {
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
  const { rowsAffected } = await db.execute({
    sql: 'INSERT OR IGNORE INTO entries (user_id, habit_id, date) VALUES (?, ?, ?)',
    args: [query.from.id, habitId, date],
  })

  // Напарникам — только если отметка действительно появилась. Повторное
  // нажатие по той же кнопке ничего не меняет, и новостью не является.
  if (rowsAffected > 0) {
    void notifyPartnersMarked(habitId, query.from.id, date).catch(() => {
      // Весть не ушла — на самой отметке это никак не сказывается.
    })
  }

  await answerCallback(query.id, t.markedToast)

  const message = query.message
  if (!message) return

  /*
   * Напоминание о назначенном часе — про одну привычку, и остальные в нём ни
   * при чём. Там, где вечернее показывает, что ещё осталось, это просто
   * отмечается: список несделанного в ответ на «сделал» выглядел бы упрёком.
   */
  if (kind === 't') {
    await editMessageText(message.chat.id, message.message_id, t.markedOne(escapeHtml(habit.name)), [])
    return
  }

  // Тот же отбор, что и в самом напоминании: привычки не на сегодня в списке
  // оставшихся не место — их и не предлагали отмечать.
  const left = await pendingHabits(query.from.id, date, weekdayOf(date))

  // Сообщение переписывается под новое состояние: кнопка уже нажата, и
  // оставлять прежний список — значит предлагать отметить отмеченное.
  const buttons = left.map((row) => [{ text: `✓ ${row.name}`, callback_data: `d:${row.id}:${date}` }])
  buttons.push([{ text: t.open, web_app: { url: webAppUrl } }])

  // Что отмечено — и что после этого осталось, с тем же расписанием, что и в
  // самом напоминании: список под кнопками не должен расходиться с кнопками.
  const text =
    left.length === 0
      ? t.allDone
      : `${t.markedOne(escapeHtml(habit.name))}\n\n${t.remainingTitle}\n${habitLines(left, query.from?.language_code)}`

  await editMessageText(message.chat.id, message.message_id, text, left.length === 0 ? [] : buttons)
}
