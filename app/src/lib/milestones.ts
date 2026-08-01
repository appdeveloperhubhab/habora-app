import type { Habit, IsoDate } from '../types'
import { appStreak, currentStreak } from './streak'

/**
 * Вехи, которые приложение празднует.
 *
 * Каждая отмечается ровно один раз: список уже показанных хранится в настройках.
 * Без этого снятие и повторная простановка галочки запускали бы салют заново,
 * и он быстро превратился бы в раздражающий мусор.
 */

export const MILESTONE_DAYS = [7, 30, 100, 365]

export type Milestone =
  | { kind: 'first'; key: string }
  | { kind: 'habit'; key: string; value: number; color: string }
  | { kind: 'app'; key: string; value: number }

/**
 * Ищет веху, достигнутую только что отмеченной привычкой.
 * Возвращает одну — самую значимую, чтобы не показывать два салюта подряд.
 */
export function detectMilestone(params: {
  habit: Habit
  habitDates: IsoDate[]
  activeDates: IsoDate[]
  totalEntries: number
  celebrated: string[]
}): Milestone | null {
  const { habit, habitDates, activeDates, totalEntries, celebrated } = params
  const seen = new Set(celebrated)

  // Первая отметка в жизни — единственная веха, не связанная с числом дней.
  if (totalEntries === 1 && !seen.has('first')) {
    return { kind: 'first', key: 'first' }
  }

  const habitValue = currentStreak(habitDates, habit.schedule).value
  if (MILESTONE_DAYS.includes(habitValue)) {
    const key = `habit:${habit.id}:${habitValue}`
    if (!seen.has(key)) return { kind: 'habit', key, value: habitValue, color: habit.color }
  }

  const appValue = appStreak(activeDates)
  if (MILESTONE_DAYS.includes(appValue)) {
    const key = `app:${appValue}`
    if (!seen.has(key)) return { kind: 'app', key, value: appValue }
  }

  return null
}
