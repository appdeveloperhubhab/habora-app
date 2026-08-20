import type { Habit, IsoDate } from '../types'
import { appStreak, currentStreak } from './streak'

/**
 * Вехи, которые приложение празднует.
 *
 * Каждая отмечается ровно один раз: список уже показанных хранится в настройках.
 * Без этого снятие и повторная простановка галочки запускали бы салют заново,
 * и он быстро превратился бы в раздражающий мусор.
 */

/**
 * Лестница вех привычки: часто в начале, реже дальше.
 *
 * Первая — на третий день, а не на седьмой: бросают именно в первые дни, и
 * неделя молчания — слишком долгий срок, чтобы дождаться первого ободрения.
 * Дальше идут недели, потом месяцы: на сотый день похвала за каждые три дня
 * уже ничего не значит, а редкая — значит.
 *
 * Шестого дня в лестнице нет намеренно, хотя он и приходится на «каждые три
 * дня»: салют шестого числа и следом седьмого — это два поздравления подряд,
 * после которых перестают радовать оба.
 */
const LADDER = [3, 7, 14, 21, 30, 60, 90, 100, 180, 270, 365]

/** После года — раз в сто дней: считать вторую годовщину точнее незачем. */
const BEYOND_YEAR_STEP = 100

/**
 * Вехи самого приложения — реже, чем у привычки.
 *
 * Заходы в приложение и выполненная привычка празднуются в одном и том же
 * окне, и будь лестницы одинаковыми, человек получал бы два салюта на одну
 * отметку. Здесь остаются только крупные числа.
 */
const APP_LADDER = [7, 30, 100, 365]

export type Milestone =
  | { kind: 'first'; key: string }
  | { kind: 'habit'; key: string; value: number; color: string }
  | { kind: 'app'; key: string; value: number }

/** Веха ли это число дней подряд. */
export function isMilestone(days: number): boolean {
  if (LADDER.includes(days)) return true
  return days > 365 && days % BEYOND_YEAR_STEP === 0
}

/**
 * Место вехи в лестнице, считая с нуля.
 *
 * По нему подбирается поздравление: соседние вехи получают разные фразы, а не
 * одну и ту же по второму разу.
 */
export function milestoneRank(days: number): number {
  const index = LADDER.indexOf(days)
  if (index >= 0) return index
  return LADDER.length + Math.floor((days - 365) / BEYOND_YEAR_STEP)
}

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
  if (isMilestone(habitValue)) {
    const key = `habit:${habit.id}:${habitValue}`
    if (!seen.has(key)) return { kind: 'habit', key, value: habitValue, color: habit.color }
  }

  const appValue = appStreak(activeDates)
  if (APP_LADDER.includes(appValue)) {
    const key = `app:${appValue}`
    if (!seen.has(key)) return { kind: 'app', key, value: appValue }
  }

  return null
}
