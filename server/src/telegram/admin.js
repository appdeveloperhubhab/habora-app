import { db, forgetBlocked } from '../db.js'
import { answerCallback, editMessageText, sendMessage } from './api.js'
import { escapeHtml } from './messages.js'

/**
 * Хозяйские команды в самом боте.
 *
 * Раньше закрыть кому-то доступ можно было только руками в базе: зайти в
 * консоль Turso, найти номер, написать UPDATE. Здесь то же самое делается с
 * телефона — списком людей и кнопкой напротив каждого.
 *
 * Тексты только по-русски, в отличие от остального бота: их видит один
 * человек — владелец, — и разводить ради него три языка незачем.
 *
 * Кто хозяин, говорит переменная окружения ADMIN_ID: его номер в Telegram.
 * Не задана — команд нет вовсе, и бот отвечает на них как на любой другой
 * непонятный текст.
 */

/** Больше тридцати кнопок в одном сообщении — уже не список, а стена. */
const SHOWN = 30

function adminId() {
  const value = Number(process.env.ADMIN_ID)
  return Number.isFinite(value) && value > 0 ? value : null
}

function isAdmin(userId) {
  const admin = adminId()
  return admin !== null && Number(userId) === admin
}

/** «сегодня», «вчера», «5 дн. назад» — чтобы отличить живых от давно ушедших. */
function ago(iso) {
  const days = Math.floor((Date.now() - Date.parse(iso ?? '')) / 86400000)
  if (!Number.isFinite(days)) return 'давно'
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  return `${days} дн. назад`
}

/** Список людей с кнопкой напротив каждого. */
async function peopleMessage() {
  const { rows } = await db.execute(
    `SELECT user_id, first_name, username, last_seen, opens, blocked
       FROM users
      ORDER BY last_seen DESC`,
  )

  if (rows.length === 0) return { text: '<b>Пока никого</b>', buttons: [] }

  const shown = rows.slice(0, SHOWN)
  const admin = adminId()

  const lines = shown.map((person, index) => {
    const name = escapeHtml(person.first_name || 'Без имени')
    const nick = person.username ? ` @${escapeHtml(person.username)}` : ''
    const me = Number(person.user_id) === admin ? ' · это вы' : ''
    const state = person.blocked === 1 ? ' · <b>доступ закрыт</b>' : ''
    return `${index + 1}. ${name}${nick} — ${ago(person.last_seen)}${me}${state}`
  })

  // Себя в кнопки не берём: заблокировав себя, хозяин отрезал бы себе и
  // приложение, и эти самые команды, которыми блокировку снимают.
  const buttons = shown
    .filter((person) => Number(person.user_id) !== admin)
    .map((person) => [
      {
        text: `${person.blocked === 1 ? '↩️' : '⛔'} ${person.first_name || person.user_id}`,
        callback_data: `ab:${person.user_id}`,
      },
    ])

  const tail = rows.length > SHOWN ? `\n\nПоказаны ${SHOWN} из ${rows.length} — по последнему заходу.` : ''

  return {
    text: `<b>Люди — ${rows.length}</b>\n\n${lines.join('\n')}${tail}`,
    buttons,
  }
}

/**
 * Хозяйская команда из сообщения.
 * @returns {Promise<boolean>} было ли сообщение командой — тогда дальше его
 * разбирать не нужно.
 */
export async function handleAdminMessage(message) {
  const text = (message.text ?? '').trim()
  const from = message.from

  /*
   * «Мой номер» — единственная команда, доступная всем. Иначе назначить
   * хозяина было бы нечем: чтобы вписать свой номер в ADMIN_ID, его надо
   * сперва где-то узнать, а узнать его больше негде.
   *
   * Секрета в этом нет: человек узнаёт свой собственный номер, и только его.
   */
  if (text === '/id') {
    await sendMessage(from.id, `Ваш номер в Telegram: <code>${from.id}</code>`)
    return true
  }

  if (text !== '/users' && text !== '/люди') return false
  if (!isAdmin(from.id)) return false

  const { text: list, buttons } = await peopleMessage()
  await sendMessage(from.id, list, buttons)
  return true
}

/**
 * Нажатие кнопки в списке людей.
 * @returns {Promise<boolean>} было ли нажатие хозяйским.
 */
export async function handleAdminCallback(query) {
  const [kind, id] = String(query.data ?? '').split(':')
  if (kind !== 'ab') return false

  if (!isAdmin(query.from?.id)) {
    await answerCallback(query.id)
    return true
  }

  const userId = Number(id)
  if (!Number.isFinite(userId) || userId === adminId()) {
    await answerCallback(query.id)
    return true
  }

  const { rows } = await db.execute({
    sql: 'SELECT blocked, first_name FROM users WHERE user_id = ?',
    args: [userId],
  })
  if (!rows[0]) {
    await answerCallback(query.id, 'Такого человека больше нет')
    return true
  }

  const next = rows[0].blocked === 1 ? 0 : 1
  await db.execute({ sql: 'UPDATE users SET blocked = ? WHERE user_id = ?', args: [next, userId] })

  // Список заблокированных сервер держит в памяти. Сбрасываем его сразу:
  // решение принято здесь и сейчас, и ждать, пока оно дойдёт само, незачем.
  forgetBlocked()

  const name = rows[0].first_name || userId
  await answerCallback(query.id, next === 1 ? `${name}: доступ закрыт` : `${name}: доступ вернули`)

  // Перерисовываем то же сообщение: список должен показывать нынешнее
  // положение дел, а не то, каким оно было до нажатия.
  const { text, buttons } = await peopleMessage()
  await editMessageText(query.message.chat.id, query.message.message_id, text, buttons)
  return true
}
