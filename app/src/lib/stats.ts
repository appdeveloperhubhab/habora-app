import type { HabitSchedule, IsoDate } from '../types'
import { addDays, fromIso, startOfWeek, todayIso, weekdayOf } from './dates'
import { completionRate } from './streak'

/**
 * Агрегаты для экрана привычки: сетка активности, помесячные и понедельные
 * суммы, разбивка по дням недели. Всё считается из одного источника — списка
 * дат, когда привычка была отмечена.
 */

export interface GridCell {
  date: IsoDate
  done: boolean
  isToday: boolean
  isFuture: boolean
}

/**
 * Сетка активности: столбцы — недели, строки — дни недели (Пн сверху).
 * Возвращает столбцы слева направо, от самой давней недели к текущей.
 */
export function activityGrid(
  dates: IsoDate[],
  weeks: number,
  today: IsoDate = todayIso(),
): GridCell[][] {
  const done = new Set(dates)
  const firstMonday = addDays(startOfWeek(today), -(weeks - 1) * 7)

  const columns: GridCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(firstMonday, w * 7)
    const column: GridCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d)
      column.push({ date, done: done.has(date), isToday: date === today, isFuture: date > today })
    }
    columns.push(column)
  }
  return columns
}

/** Сколько отметок пришлось на месяц, в котором лежит дата. */
export function countInMonth(dates: IsoDate[], iso: IsoDate = todayIso()): number {
  const prefix = iso.slice(0, 7)
  return dates.filter((date) => date.startsWith(prefix)).length
}

/** Сколько отметок пришлось на неделю, в которой лежит дата. */
export function countInWeek(dates: IsoDate[], iso: IsoDate = todayIso()): number {
  const monday = startOfWeek(iso)
  const sunday = addDays(monday, 6)
  return dates.filter((date) => date >= monday && date <= sunday).length
}

/** Отметки по месяцам выбранного года: 12 чисел, январь → декабрь. */
function monthlyCounts(dates: IsoDate[], year: number): number[] {
  const counts = new Array(12).fill(0)
  for (const date of dates) {
    const d = fromIso(date)
    if (d.getFullYear() === year) counts[d.getMonth()]++
  }
  return counts
}

export type TimelinePeriod = 'week' | 'month' | 'year'

export interface TimelinePoint {
  /** Подпись под осью: день, число или буква месяца. */
  label: string
  value: number
  /** Дата начала интервала — нужна для всплывающих подсказок. */
  date: IsoDate
}

/**
 * Хронология отметок. Масштаб выбирает пользователь: неделя показывает дни,
 * месяц — дни месяца, год — суммы по месяцам.
 */
export function timeline(
  dates: IsoDate[],
  period: TimelinePeriod,
  monthLabels: string[],
  today: IsoDate = todayIso(),
): TimelinePoint[] {
  const done = new Set(dates)

  if (period === 'week') {
    const monday = startOfWeek(today)
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      return { label: String(fromIso(date).getDate()), value: done.has(date) ? 1 : 0, date }
    })
  }

  if (period === 'month') {
    const d = fromIso(today)
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      const date = `${today.slice(0, 7)}-${day}`
      return { label: String(i + 1), value: done.has(date) ? 1 : 0, date }
    })
  }

  const year = fromIso(today).getFullYear()
  const counts = monthlyCounts(dates, year)
  return counts.map((value, index) => ({
    label: monthLabels[index],
    value,
    date: `${year}-${String(index + 1).padStart(2, '0')}-01`,
  }))
}

export type ConsistencyLevel = 'high' | 'medium' | 'low'

export interface Consistency {
  /** Доля выполнения за последние 30 дней, 0…1. */
  ratio: number
  level: ConsistencyLevel
}

/**
 * Последовательность — качественная оценка того, насколько ровно человек
 * держит привычку последний месяц. Пороги намеренно щадящие: требовать
 * безупречных 100% ради оценки «высокий» демотивирует.
 */
export function consistency(
  dates: IsoDate[],
  schedule: HabitSchedule,
  today: IsoDate = todayIso(),
): Consistency {
  const ratio = completionRate(dates, schedule, 30, today)
  const level: ConsistencyLevel = ratio >= 0.75 ? 'high' : ratio >= 0.4 ? 'medium' : 'low'
  return { ratio, level }
}

/**
 * Сделано за месяц из того, что было положено по расписанию.
 *
 * Считаем только по сегодняшний день, а не весь месяц: с полным месяцем
 * первого числа выходило бы «0 из 22», и цифра каждый раз начинала бы с
 * приговора вместо отчёта. «Из положенного к этому дню» — то, по чему себя
 * и оценивают.
 *
 * У расписания «N раз в неделю» конкретных дней нет — там за положенное
 * берём число прошедших недель на недельную норму.
 */
export function monthProgress(
  dates: IsoDate[],
  schedule: HabitSchedule,
  today: IsoDate = todayIso(),
): { done: number; planned: number } {
  const marks = new Set(dates)
  const day = Number(today.slice(8, 10))
  const first = `${today.slice(0, 8)}01`

  /*
   * Считаем только дни из расписания — и в положенном, и в сделанном.
   *
   * Отметку можно поставить в любой прошедший день, тапнув по календарю, в
   * том числе не по расписанию. Считай мы все подряд, у привычки «Пн, Ср, Пт»
   * выходило бы «16 из 9» — сделано больше, чем положено, и пара переставала
   * бы читаться. Отметки сверх плана от этого не пропадают: они есть в
   * календаре, в сетке года и в хронологии.
   */
  if (schedule.type === 'frequency') {
    const weeks = Math.max(1, Math.ceil(day / 7))
    const planned = weeks * Math.max(1, schedule.timesPerWeek)
    let done = 0
    for (let i = 0; i < day; i++) {
      if (marks.has(addDays(first, i))) done++
    }
    // У недельной нормы расписания по дням нет, и «сверх плана» здесь
    // возможно так же — ограничиваем самой нормой.
    return { done: Math.min(done, planned), planned }
  }

  let done = 0
  let planned = 0
  for (let i = 0; i < day; i++) {
    const date = addDays(first, i)
    if (!schedule.days.includes(weekdayOf(date))) continue
    planned++
    if (marks.has(date)) done++
  }
  return { done, planned }
}

/** Годы, за которые есть хотя бы одна отметка, по убыванию. */
export function yearsWithData(dates: IsoDate[], today: IsoDate = todayIso()): number[] {
  const years = new Set(dates.map((date) => Number(date.slice(0, 4))))
  years.add(fromIso(today).getFullYear())
  return [...years].sort((a, b) => b - a)
}
