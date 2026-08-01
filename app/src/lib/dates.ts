import type { IsoDate, Lang, Weekday } from '../types'

/**
 * Все даты в приложении — строки `YYYY-MM-DD` в локальной таймзоне пользователя.
 * Намеренно не используем `toISOString()`: он переводит в UTC и в вечерние часы
 * возвращает завтрашний день, из-за чего отметка «сегодня» уезжает на сутки.
 */
export function toIso(date: Date): IsoDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayIso(): IsoDate {
  return toIso(new Date())
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIso(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const date = fromIso(iso)
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  return toIso(date)
}

/** Разница в днях: положительная, если `a` позже `b`. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  const ms = fromIso(a).getTime() - fromIso(b).getTime()
  return Math.round(ms / 86400000)
}

/** День недели, 0 = понедельник … 6 = воскресенье (не как у Date, где 0 — воскресенье). */
export function weekdayOf(iso: IsoDate): Weekday {
  return ((fromIso(iso).getDay() + 6) % 7) as Weekday
}

export function isWeekend(iso: IsoDate): boolean {
  return weekdayOf(iso) >= 5
}

/** Понедельник той недели, в которую попадает дата. */
export function startOfWeek(iso: IsoDate): IsoDate {
  return addDays(iso, -weekdayOf(iso))
}

export function startOfMonth(iso: IsoDate): IsoDate {
  const date = fromIso(iso)
  return toIso(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonth(iso: IsoDate): IsoDate {
  const date = fromIso(iso)
  return toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function daysInMonth(iso: IsoDate): number {
  const date = fromIso(iso)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/** Отрезок дат от `from` до `to` включительно. */
export function rangeDays(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Последние `n` дней, заканчивая на `end` включительно (по возрастанию). */
export function lastNDays(n: number, end: IsoDate = todayIso()): IsoDate[] {
  return rangeDays(addDays(end, -(n - 1)), end)
}

/** Текущая неделя целиком, Пн–Вс. */
export function currentWeek(today: IsoDate = todayIso()): IsoDate[] {
  const monday = startOfWeek(today)
  return rangeDays(monday, addDays(monday, 6))
}

/**
 * Сетка месяца для календаря: недели по 7 дней, Пн–Вс.
 * Дни соседних месяцев дополняют края и помечены `outside`.
 */
export function monthGrid(iso: IsoDate): { date: IsoDate; outside: boolean }[][] {
  const first = startOfMonth(iso)
  const last = endOfMonth(iso)
  const gridStart = startOfWeek(first)
  const gridEnd = addDays(startOfWeek(last), 6)

  const weeks: { date: IsoDate; outside: boolean }[][] = []
  let week: { date: IsoDate; outside: boolean }[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    week.push({ date: d, outside: d < first || d > last })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  return weeks
}

const MONTHS_RU_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const MONTHS_RU_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const WEEKDAYS_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_SHORT_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_MIN_RU = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В']
const WEEKDAYS_MIN_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Дата в шапке: «21 июля» / «July 21». */
export function formatDayMonth(iso: IsoDate, lang: Lang): string {
  const date = fromIso(iso)
  return lang === 'ru'
    ? `${date.getDate()} ${MONTHS_RU_GENITIVE[date.getMonth()]}`
    : `${MONTHS_EN[date.getMonth()]} ${date.getDate()}`
}

/** Заголовок календаря: «Июль 2026» / «July 2026». */
export function formatMonthYear(iso: IsoDate, lang: Lang): string {
  const date = fromIso(iso)
  const months = lang === 'ru' ? MONTHS_RU_NOMINATIVE : MONTHS_EN
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export function monthShort(monthIndex: number, lang: Lang): string {
  return (lang === 'ru' ? MONTHS_SHORT_RU : MONTHS_SHORT_EN)[monthIndex]
}

export function weekdayShort(day: Weekday, lang: Lang): string {
  return (lang === 'ru' ? WEEKDAYS_SHORT_RU : WEEKDAYS_SHORT_EN)[day]
}

export function weekdayMin(day: Weekday, lang: Lang): string {
  return (lang === 'ru' ? WEEKDAYS_MIN_RU : WEEKDAYS_MIN_EN)[day]
}
