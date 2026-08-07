import { db } from '../db.js'
import { sendMessage } from './api.js'
import { escapeHtml, scheduleLabel, texts } from './messages.js'

/**
 * Ежедневное напоминание о невыполненных привычках.
 *
 * Час выбран вечерний: напоминание имеет смысл, когда день почти прошёл, а
 * привычка так и не отмечена. Утром напоминать не о чем — ещё все успеется.
 */
const REMINDER_HOUR = Number(process.env.REMINDER_HOUR ?? 19)

/** Больше пяти кнопок под сообщением превращаются в стену — остальное в приложении. */
const MAX_BUTTONS = 5

/**
 * Местные дата и час человека.
 *
 * Сервер живёт по UTC, а «вечер» у каждого свой. Сдвигаем сам момент времени
 * на его смещение и читаем UTC-полями: так получается его настенное время без
 * возни с часовыми поясами.
 */
export function localNow(tzOffsetMinutes, now = Date.now()) {
  const shifted = new Date(now + (tzOffsetMinutes ?? 0) * 60000)
  const date = [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-')

  return {
    date,
    hour: shifted.getUTCHours(),
    // В приложении неделя начинается с понедельника, а в JS — с воскресенья.
    weekday: (shifted.getUTCDay() + 6) % 7,
  }
}

/** День недели по дате `YYYY-MM-DD`, где 0 — понедельник. */
export function weekdayOf(date) {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/**
 * Входит ли день в расписание привычки.
 * Повторяет `isScheduled` из app/src/lib/streak.ts — у расписания
 * «N раз в неделю» конкретных дней нет, поэтому подходит любой.
 */
export function isScheduled(weekday, schedule) {
  if (schedule?.type === 'frequency') return true
  return Array.isArray(schedule?.days) && schedule.days.includes(weekday)
}

/**
 * Привычки, которые сегодня по расписанию и ещё не отмечены.
 * Отбор идёт по участию, а не по создательству: в совместной привычке
 * напоминание нужно каждому, а не только заведшему её.
 */
export async function pendingHabits(userId, date, weekday) {
  const { rows } = await db.execute({
    sql: `SELECT h.id, h.name, h.schedule
            FROM habit_members m
            JOIN habits h ON h.id = m.habit_id
            LEFT JOIN entries e
                   ON e.habit_id = h.id AND e.user_id = m.user_id AND e.date = ?
           WHERE m.user_id = ? AND e.habit_id IS NULL
           ORDER BY m.sort_order, h.created_at`,
    args: [date, userId],
  })

  return rows
    .map((row) => ({ id: row.id, name: row.name, schedule: JSON.parse(row.schedule) }))
    // Расписание нужно и дальше — по нему в напоминании видно, в какие дни
    // привычку положено выполнять, — поэтому оно едет с привычкой, а не
    // выбрасывается сразу после отбора.
    .filter((habit) => isScheduled(weekday, habit.schedule))
}

/**
 * Список привычек строками: название и когда его положено выполнять.
 *
 * Расписание рядом с названием — ответ на вопрос «а почему ты мне об этом
 * пишешь именно сегодня». Без него привычка «по Пн, Ср, Пт» выглядела бы в
 * четверг ошибкой напоминания.
 */
export function habitLines(habits, language) {
  const t = texts(language)
  return habits
    .map((habit) => t.reminderItem(escapeHtml(habit.name), scheduleLabel(habit.schedule, language)))
    .join('\n')
}

/** Текст и кнопки напоминания. */
export function reminderMessage(habits, language, webAppUrl, date) {
  const t = texts(language)
  const text = `${t.reminderTitle}\n\n${habitLines(habits, language)}`

  const buttons = habits.slice(0, MAX_BUTTONS).map((habit) => [
    // Отметить прямо из чата: секунда против «разблокировать телефон, найти
    // чат, открыть приложение, найти привычку».
    { text: `✓ ${habit.name}`, callback_data: `d:${habit.id}:${date}` },
  ])
  buttons.push([{ text: t.open, web_app: { url: webAppUrl } }])

  return { text, buttons }
}

/**
 * Один проход будильника: рассылает напоминания тем, у кого сейчас нужный час.
 *
 * Отметка о рассылке ставится и тогда, когда отправлять нечего: иначе каждый
 * следующий стук будильника заново перебирал бы привычки этого человека весь
 * вечер.
 */
export async function runReminderTick(webAppUrl, now = Date.now()) {
  const { rows } = await db.execute(
    'SELECT user_id, language, tz_offset, reminded_on FROM users WHERE chat_started = 1',
  )

  const result = { checked: rows.length, sent: 0, skipped: 0 }

  for (const user of rows) {
    const { date, hour, weekday } = localNow(user.tz_offset, now)
    if (hour !== REMINDER_HOUR || user.reminded_on === date) {
      result.skipped++
      continue
    }

    await db.execute({
      sql: 'UPDATE users SET reminded_on = ? WHERE user_id = ?',
      args: [date, user.user_id],
    })

    const habits = await pendingHabits(user.user_id, date, weekday)
    if (habits.length === 0) continue

    const { text, buttons } = reminderMessage(habits, user.language, webAppUrl, date)
    await sendMessage(user.user_id, text, buttons)
    result.sent++
  }

  return result
}
