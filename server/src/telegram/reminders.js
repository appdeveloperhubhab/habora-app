import { db } from '../db.js'
import { sendMessage } from './api.js'
import { escapeHtml, scheduleLabel, texts } from './messages.js'
import { forgetOldNotices } from './partners.js'

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
    // Минуты от полуночи: время у привычки задаётся с точностью до минуты,
    // и одного часа для сравнения с ним не хватает.
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
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
 * Один проход будильника.
 *
 * Оба вида напоминаний идут одним заходом: вечернее — общим списком
 * несделанного, и по каждой привычке — в назначенный ей час. Будильник
 * снаружи один, и заводить ради второго вида ещё один незачем.
 */
export async function runReminderTick(webAppUrl, now = Date.now()) {
  const evening = await runEveningReminders(webAppUrl, now)
  const timed = await runTimedReminders(webAppUrl, now)

  /*
   * Заодно подчищаем записи о вестях напарникам.
   *
   * Они нужны ровно на один день — чтобы одна и та же отметка не разошлась
   * двумя сообщениями, — а живут иначе вечно, по строке на каждую отметку в
   * каждой общей привычке. Порог с запасом в двое суток: часовые пояса
   * разводят «сегодня» разных людей почти на день.
   */
  const twoDaysBack = new Date(now - 2 * 86400000).toISOString().slice(0, 10)
  const forgotten = await forgetOldNotices(twoDaysBack)

  return { ...evening, timed, forgotten }
}

/**
 * Вечернее напоминание: одно сообщение со всем несделанным за день.
 *
 * Отметка о рассылке ставится и тогда, когда отправлять нечего: иначе каждый
 * следующий стук будильника заново перебирал бы привычки этого человека весь
 * вечер.
 */
export async function runEveningReminders(webAppUrl, now = Date.now()) {
  /*
   * Настройки приходят вместе с человеком одним запросом. Спрашивать их
   * отдельно для каждого значило бы столько же походов в базу, сколько людей,
   * — и всё это каждые пять минут, ради того чтобы почти всегда узнать, что
   * сейчас не их час.
   */
  const { rows } = await db.execute(
    `SELECT u.user_id, u.language, u.tz_offset, u.reminded_on, s.data AS settings
       FROM users u
       LEFT JOIN settings s ON s.user_id = u.user_id
      WHERE u.chat_started = 1 AND u.blocked = 0`,
  )

  const result = { checked: rows.length, sent: 0, off: 0, skipped: 0 }

  for (const user of rows) {
    const settings = parseSettings(user.settings)

    // Выключено в настройках — молчим. Проверка стоит до часа и до отметки
    // о рассылке: ни того, ни другого для молчания знать не нужно.
    if (settings.reminders === false) {
      result.off++
      continue
    }

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

    /*
     * Язык напоминания — тот, что человек выбрал в приложении, и только если
     * не выбирал — язык его Telegram. Иначе выбор языка в настройках означал
     * бы «переведи экраны, но пиши мне по-прежнему на другом».
     */
    const language = settings.lang ?? user.language

    const { text, buttons } = reminderMessage(habits, language, webAppUrl, date)
    await sendMessage(user.user_id, text, buttons)
    result.sent++
  }

  return result
}

/**
 * Насколько поздно ещё имеет смысл напоминать, в минутах.
 *
 * Попасть ровно в назначенную минуту нельзя: будильник снаружи стучится раз в
 * несколько минут, а сервер на бесплатном тарифе между стуками успевает
 * заснуть и просыпается не сразу. Небольшое опоздание поэтому допускается.
 * Но напоминание о девяти утра, пришедшее вечером, — уже не напоминание:
 * дальше этого предела день считается пропущенным.
 */
const LATE_LIMIT_MINUTES = 90

/** `ЧЧ:ММ` в минуты от полуночи; null — время записано не так. */
export function minutesOfDay(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours > 23 || minutes > 59 ? null : hours * 60 + minutes
}

/**
 * Напоминание в назначенный привычке час.
 *
 * Время у привычки одно на всех участников: договариваются делать вместе, и
 * разное время у каждого означало бы разные привычки под одним названием.
 * А вот наступает оно у всех по-своему — участники живут в разных часовых
 * поясах, — поэтому перебираем не привычки, а участие в них, и дату отправки
 * помним у каждого свою.
 */
export async function runTimedReminders(webAppUrl, now = Date.now()) {
  const { rows } = await db.execute(`
    SELECT m.habit_id, m.user_id, m.reminded_on, m.remind_at,
           h.name, h.schedule,
           u.language, u.tz_offset,
           s.data AS settings
      FROM habit_members m
      JOIN habits h ON h.id = m.habit_id
      JOIN users  u ON u.user_id = m.user_id
      LEFT JOIN settings s ON s.user_id = m.user_id
     WHERE m.remind_at IS NOT NULL AND u.chat_started = 1 AND u.blocked = 0
  `)

  const result = { checked: rows.length, sent: 0, skipped: 0 }

  for (const row of rows) {
    const settings = parseSettings(row.settings)
    if (settings.reminders === false) {
      result.skipped++
      continue
    }

    const { date, minutes, weekday } = localNow(row.tz_offset, now)
    const at = minutesOfDay(row.remind_at)
    const late = at === null ? null : minutes - at

    // До назначенного часа — рано, много позже — уже поздно, а сегодня
    // отправленное второй раз не отправляют.
    if (row.reminded_on === date || late === null || late < 0 || late > LATE_LIMIT_MINUTES) {
      result.skipped++
      continue
    }

    /*
     * Отметка ставится до проверок ниже, а не после отправки. День не по
     * расписанию и уже отмеченная привычка иначе перебирались бы заново каждым
     * следующим стуком будильника — весь остаток отведённого времени.
     */
    await db.execute({
      sql: 'UPDATE habit_members SET reminded_on = ? WHERE habit_id = ? AND user_id = ?',
      args: [date, row.habit_id, row.user_id],
    })

    if (!isScheduled(weekday, JSON.parse(row.schedule))) continue

    const done = await db.execute({
      sql: 'SELECT 1 FROM entries WHERE habit_id = ? AND user_id = ? AND date = ?',
      args: [row.habit_id, row.user_id, date],
    })
    if (done.rows[0]) continue

    // Язык — тот же, что и у вечернего: выбранный в приложении, а если не
    // выбирали — язык Telegram.
    const t = texts(settings.lang ?? row.language)

    await sendMessage(row.user_id, t.timedReminder(escapeHtml(row.name)), [
      // Отметить прямо из чата — как и под вечерним напоминанием.
      [{ text: t.markButton, callback_data: `t:${row.habit_id}:${date}` }],
      [{ text: t.open, web_app: { url: webAppUrl } }],
    ])
    result.sent++
  }

  return result
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
