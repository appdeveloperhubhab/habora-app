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
export function monthlyCounts(dates: IsoDate[], year: number): number[] {
  const counts = new Array(12).fill(0)
  for (const date of dates) {
    const d = fromIso(date)
    if (d.getFullYear() === year) counts[d.getMonth()]++
  }
  return counts
}

/** Отметки по дням недели за последние `months` месяцев: 7 чисел, Пн → Вс. */
export function weekdayCounts(
  dates: IsoDate[],
  months = 12,
  today: IsoDate = todayIso(),
): number[] {
  const from = addDays(today, -Math.round(months * 30.4))
  const counts = new Array(7).fill(0)
  for (const date of dates) {
    if (date < from) continue
    counts[weekdayOf(date)]++
  }
  return counts
}

/** Доля отметок в рабочие дни против выходных, в процентах. */
export function workWeekendSplit(dates: IsoDate[], months = 12, today: IsoDate = todayIso()) {
  const counts = weekdayCounts(dates, months, today)
  const work = counts.slice(0, 5).reduce((a, b) => a + b, 0)
  const weekend = counts[5] + counts[6]
  const total = work + weekend
  if (total === 0) return { work: 0, weekend: 0, workPercent: 0, weekendPercent: 0 }
  return {
    work,
    weekend,
    workPercent: Math.round((work / total) * 100),
    weekendPercent: Math.round((weekend / total) * 100),
  }
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

/** Годы, за которые есть хотя бы одна отметка, по убыванию. */
export function yearsWithData(dates: IsoDate[], today: IsoDate = todayIso()): number[] {
  const years = new Set(dates.map((date) => Number(date.slice(0, 4))))
  years.add(fromIso(today).getFullYear())
  return [...years].sort((a, b) => b - a)
}
