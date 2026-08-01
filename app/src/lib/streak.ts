import type { HabitSchedule, IsoDate } from '../types'
import { addDays, currentWeek, diffDays, startOfWeek, todayIso, weekdayOf } from './dates'

/**
 * Расчёт серий и процента выполнения.
 *
 * Ключевая тонкость: пропуск дня, который не входит в расписание привычки,
 * серию не рвёт. Привычка «по Пн/Ср/Пт» не должна обнуляться во вторник —
 * иначе цифра теряет смысл и демотивирует.
 */

export type StreakUnit = 'days' | 'weeks'

export interface Streak {
  value: number
  /**
   * У расписания «по дням недели» серия считается в днях. У расписания
   * «N раз в неделю» конкретных дней нет, поэтому единица измерения — недели:
   * серия продолжается, пока пользователь закрывает недельную норму.
   */
  unit: StreakUnit
}

/** Входит ли день в расписание привычки. */
export function isScheduled(date: IsoDate, schedule: HabitSchedule): boolean {
  if (schedule.type === 'frequency') return true
  return schedule.days.includes(weekdayOf(date))
}

/** Сколько отметок пришлось на неделю, в которую попадает дата. */
function doneInWeek(done: Set<IsoDate>, anyDayOfWeek: IsoDate): number {
  const monday = startOfWeek(anyDayOfWeek)
  let count = 0
  for (let i = 0; i < 7; i++) {
    if (done.has(addDays(monday, i))) count++
  }
  return count
}

/** Текущая серия на сегодняшний день. */
export function currentStreak(
  dates: IsoDate[],
  schedule: HabitSchedule,
  today: IsoDate = todayIso(),
): Streak {
  const done = new Set(dates)
  if (done.size === 0) return { value: 0, unit: schedule.type === 'frequency' ? 'weeks' : 'days' }

  if (schedule.type === 'frequency') {
    const target = Math.max(1, schedule.timesPerWeek)
    let weeks = 0
    let cursor = startOfWeek(today)

    // Текущая неделя ещё не закончилась: её недобор — не разрыв серии,
    // просто она пока не засчитана.
    if (doneInWeek(done, cursor) >= target) weeks++
    cursor = addDays(cursor, -7)

    while (doneInWeek(done, cursor) >= target) {
      weeks++
      cursor = addDays(cursor, -7)
      if (weeks > 520) break // страховка от бесконечного цикла
    }
    return { value: weeks, unit: 'weeks' }
  }

  const earliest = dates[0]
  let streak = 0
  let cursor = today

  while (diffDays(cursor, earliest) >= 0) {
    if (!isScheduled(cursor, schedule)) {
      cursor = addDays(cursor, -1)
      continue
    }
    if (done.has(cursor)) {
      streak++
    } else if (cursor !== today) {
      // Сегодняшний день ещё можно закрыть, поэтому его пропуск серию не рвёт.
      break
    }
    cursor = addDays(cursor, -1)
  }
  return { value: streak, unit: 'days' }
}

/** Самая длинная серия за всю историю привычки. */
export function longestStreak(
  dates: IsoDate[],
  schedule: HabitSchedule,
  today: IsoDate = todayIso(),
): Streak {
  const done = new Set(dates)
  if (done.size === 0) return { value: 0, unit: schedule.type === 'frequency' ? 'weeks' : 'days' }

  if (schedule.type === 'frequency') {
    const target = Math.max(1, schedule.timesPerWeek)
    let best = 0
    let run = 0
    let cursor = startOfWeek(dates[0])
    const lastMonday = startOfWeek(today)

    while (cursor <= lastMonday) {
      if (doneInWeek(done, cursor) >= target) {
        run++
        best = Math.max(best, run)
      } else {
        run = 0
      }
      cursor = addDays(cursor, 7)
    }
    return { value: best, unit: 'weeks' }
  }

  let best = 0
  let run = 0
  for (let cursor = dates[0]; cursor <= today; cursor = addDays(cursor, 1)) {
    if (!isScheduled(cursor, schedule)) continue
    if (done.has(cursor)) {
      run++
      best = Math.max(best, run)
    } else if (cursor !== today) {
      run = 0
    }
  }
  return { value: best, unit: 'days' }
}

/**
 * Доля выполнения за последние `days` дней: считаются только те дни,
 * которые входили в расписание, иначе привычка «3 раза в неделю» никогда
 * не показала бы 100%.
 */
export function completionRate(
  dates: IsoDate[],
  schedule: HabitSchedule,
  days = 30,
  today: IsoDate = todayIso(),
): number {
  const done = new Set(dates)

  if (schedule.type === 'frequency') {
    const target = Math.max(1, schedule.timesPerWeek)
    const weeks = Math.max(1, Math.round(days / 7))
    let planned = 0
    let completed = 0
    let cursor = startOfWeek(today)
    for (let i = 0; i < weeks; i++) {
      planned += target
      completed += Math.min(target, doneInWeek(done, cursor))
      cursor = addDays(cursor, -7)
    }
    return planned === 0 ? 0 : completed / planned
  }

  let planned = 0
  let completed = 0
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i)
    if (!isScheduled(date, schedule)) continue
    planned++
    if (done.has(date)) completed++
  }
  return planned === 0 ? 0 : completed / planned
}

/** Отметки за текущую неделю — для строки квадратиков на карточке. */
export function weekProgress(dates: IsoDate[], today: IsoDate = todayIso()) {
  const done = new Set(dates)
  return currentWeek(today).map((date) => ({
    date,
    done: done.has(date),
    isToday: date === today,
    isFuture: date > today,
  }))
}

/** Всего отметок за всё время. */
export function totalCount(dates: IsoDate[]): number {
  return dates.length
}

/**
 * Общая серия приложения: сколько дней подряд человек отметил хоть что-нибудь —
 * привычку или задачу.
 *
 * В отличие от серии привычки, здесь нет расписания: засчитывается любой день,
 * в котором была хотя бы одна отметка. Одна такая цифра держит внимание лучше,
 * чем десяток разрозненных серий по каждой привычке в отдельности.
 */
export function appStreak(activeDates: IsoDate[], today: IsoDate = todayIso()): number {
  if (activeDates.length === 0) return 0

  const active = new Set(activeDates)
  let streak = 0
  let cursor = today

  // Сегодняшний день ещё не закончился: если он пуст, серию это не рвёт,
  // просто начинаем считать со вчера.
  if (!active.has(cursor)) cursor = addDays(cursor, -1)

  while (active.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}
