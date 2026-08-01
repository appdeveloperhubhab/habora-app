import type { HabitSchedule, Lang } from '../../types'
import type { Dict } from '../../i18n'
import { weekdayShort } from '../../lib/dates'

/**
 * Короткая подпись расписания под названием привычки: «Каждый день»,
 * «Пн, Ср, Пт» или «3 раза в неделю».
 */
export function scheduleLabel(schedule: HabitSchedule, lang: Lang, t: Dict): string {
  if (schedule.type === 'frequency') {
    const n = schedule.timesPerWeek
    if (lang === 'ru') {
      // Русскому нужны две формы: «2 раза», но «5 раз».
      const lastTwo = n % 100
      const last = n % 10
      const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
      return `${n} ${few ? t.habits.timesAWeekFew : t.habits.timesAWeek}`
    }
    return `${n} ${n === 1 ? t.habits.timesAWeek : t.habits.timesAWeekFew}`
  }

  if (schedule.days.length === 7) return t.habits.everyday
  return schedule.days.map((day) => weekdayShort(day, lang)).join(', ')
}
