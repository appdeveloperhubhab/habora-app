import { db } from '../db.js'
import { sendMessage } from './api.js'
import { escapeHtml, texts } from './messages.js'

/**
 * Весть напарникам: кто-то из них отметил общую привычку.
 *
 * Это то, ради чего совместные привычки и затевались. Раньше о том, что друг
 * сегодня уже сделал своё, можно было узнать, только открыв приложение и
 * дойдя до привычки, — то есть ровно тогда, когда сам о ней вспомнил.
 * Совместность существовала в базе, но не в жизни.
 *
 * Шлём только о простановке отметки и только у общих привычек: у личной
 * напарников нет, а снятие отметки — не новость, а чужая неудача, и
 * рассказывать о ней некрасиво.
 */

/** Отметился ли человек в привычке в этот день. */
function doneToday(rows, userId) {
  return rows.some((row) => Number(row.user_id) === Number(userId))
}

export async function notifyPartnersMarked(habitId, actorId, date) {
  /*
   * Право сообщить занимаем до отправки, а не после: пока сообщения уходят в
   * сеть, вторая отметка того же человека успела бы пройти проверку и послать
   * всё второй раз. Ноль изменённых строк — значит, об этом дне уже сообщали.
   */
  const claim = await db.execute({
    sql: 'INSERT OR IGNORE INTO mark_notices (habit_id, actor_id, date) VALUES (?, ?, ?)',
    args: [habitId, actorId, date],
  })
  if (claim.rowsAffected === 0) return { sent: 0, reason: 'уже сообщали' }

  // Участники, название привычки и имя отметившегося — одним запросом:
  // отдельными это четыре похода в облачную базу на каждое касание галочки.
  const { rows } = await db.execute({
    sql: `SELECT m.user_id, u.language, u.chat_started, s.data AS settings,
                 h.name AS habit_name, a.first_name AS actor_name
            FROM habit_members m
            JOIN habits h ON h.id = m.habit_id
            LEFT JOIN users u ON u.user_id = m.user_id
            LEFT JOIN settings s ON s.user_id = m.user_id
            LEFT JOIN users a ON a.user_id = ?
           WHERE m.habit_id = ? AND m.user_id <> ?`,
    args: [actorId, habitId, actorId],
  })

  // Привычка личная — напарников нет, и рассказывать некому.
  if (rows.length === 0) return { sent: 0, reason: 'некому' }

  // Кто из напарников уже отметился сегодня: от этого зависит, чем закончить
  // сообщение — подначкой или поздравлением обоих.
  const { rows: marked } = await db.execute({
    sql: 'SELECT user_id FROM entries WHERE habit_id = ? AND date = ?',
    args: [habitId, date],
  })

  const habitName = escapeHtml(rows[0].habit_name ?? '')
  const actorName = escapeHtml(rows[0].actor_name ?? '')

  let sent = 0
  for (const partner of rows) {
    // Telegram запрещает боту писать первым: без «Старта» сообщение не дойдёт.
    if (partner.chat_started !== 1) continue

    // Выключил сообщения бота — молчим и здесь. Отдельного выключателя для
    // вестей о напарнике нет: человек попросил не писать ему, а не «не писать
    // об одном, но писать о другом».
    const settings = parseSettings(partner.settings)
    if (settings.reminders === false) continue

    const t = texts(settings.lang ?? partner.language)
    const мой = doneToday(marked, partner.user_id)

    /*
     * Само сообщение одно на оба случая — две строки, кто и что сделал.
     * Прежде к нему приписывалась третья: «ваша очередь» либо «сегодня оба».
     * Её убрали: очередь и без слов видна по кнопке ниже, а когда кнопки нет,
     * значит уже отмечено — говорить об этом отдельной строкой незачем.
     */
    const text = t.partnerMarked(actorName, habitName)

    // Отметиться прямо отсюда — та же кнопка, что и под вечерним
    // напоминанием. Тому, кто уже отметился, нажимать нечего.
    const buttons = мой ? undefined : [[{ text: t.markIt, callback_data: `d:${habitId}:${date}` }]]

    const result = await sendMessage(partner.user_id, text, buttons)
    if (result?.ok) sent++
  }

  return { sent, total: rows.length }
}

/**
 * Весть об удалении общей привычки.
 *
 * Отметки исчезают у человека без его участия — по чужой воле. Молчание тут
 * хуже всего: он открывает приложение, привычки нет, серии нет, и первое, что
 * он подумает, — что данные потеряло приложение. Сообщение отвечает на оба
 * вопроса сразу: что случилось и кто это сделал.
 *
 * Участники и название передаются готовыми: к моменту вызова привычки в базе
 * уже нет, и спросить их было бы негде.
 */
export async function notifyHabitDeleted(others, habitName, actorName) {
  const habit = escapeHtml(habitName ?? '')
  const actor = escapeHtml(actorName ?? '')

  let sent = 0
  for (const partner of others) {
    if (partner.chat_started !== 1) continue

    const settings = parseSettings(partner.settings)
    if (settings.reminders === false) continue

    const t = texts(settings.lang ?? partner.language)
    const result = await sendMessage(partner.user_id, t.habitDeleted(actor, habit))
    if (result?.ok) sent++
  }

  return { sent, total: others.length }
}

/**
 * Чистка старых записей об отправленных вестях.
 *
 * Дальше сегодняшнего дня они не нужны: повтор ловится только в пределах
 * одного дня. Без чистки таблица росла бы вечно — по строке на каждую
 * отметку в каждой общей привычке.
 */
export async function forgetOldNotices(beforeDate) {
  const { rowsAffected } = await db.execute({
    sql: 'DELETE FROM mark_notices WHERE date < ?',
    args: [beforeDate],
  })
  return rowsAffected
}

/** Настройки человека из хранилища; при любой поломке — пустые. */
function parseSettings(raw) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
