import { useState } from 'react'
import type { Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import { addMonths, formatMonthYear, fromIso, monthGrid, todayIso, weekdayMin } from '../../../lib/dates'
import { hapticSelect, hapticTick, hapticUntick } from '../../../lib/haptics'
import { Icon } from '../../../ui/Icon'
import styles from './MonthCalendar.module.css'

/**
 * Календарь месяца. В отличие от сетки активности, которая показывает
 * «сколько», этот блок показывает «когда именно»: у каждой клетки есть число
 * и день недели, чтобы не пересчитывать вручную, на какой день пришлась отметка.
 *
 * Здесь же закрываются пропуски: тап по прошедшему дню ставит или снимает
 * отметку задним числом. Будущие дни недоступны.
 */
export function MonthCalendar({
  dates,
  color,
  lang,
  t,
  onToggleDay,
}: {
  dates: string[]
  color: string
  lang: Lang
  t: Dict
  onToggleDay(date: string): void
}) {
  const today = todayIso()
  const [month, setMonth] = useState(today)
  const done = new Set(dates)
  const weeks = monthGrid(month)

  const shiftMonth = (delta: number) => {
    hapticSelect()
    setMonth((current) => addMonths(current, delta))
  }

  return (
    <section className={styles.card} style={{ '--habit': color } as React.CSSProperties}>
      <header className={styles.header}>
        <h3 className={styles.title}>{t.detail.calendar}</h3>
        <div className={styles.nav}>
          <button className={styles.navButton} onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" size={18} />
          </button>
          <span className={styles.month}>{formatMonthYear(month, lang)}</span>
          <button
            className={styles.navButton}
            onClick={() => shiftMonth(1)}
            // Листать в будущее незачем: отмечать вперёд нельзя.
            disabled={month.slice(0, 7) >= today.slice(0, 7)}
            aria-label="Next month"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </header>

      <div className={styles.weekdays}>
        {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
          <span key={day} className={styles.weekdayLabel}>
            {weekdayMin(day, lang)}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {weeks.map((week) =>
          week.map((cell) => {
            const isDone = done.has(cell.date)
            const isFuture = cell.date > today
            return (
              <button
                key={cell.date}
                className={[
                  styles.day,
                  isDone ? styles.done : '',
                  cell.date === today ? styles.today : '',
                  cell.outside ? styles.outside : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={isFuture}
                onClick={() => {
                  if (isDone) hapticUntick()
                  else hapticTick()
                  onToggleDay(cell.date)
                }}
              >
                {fromIso(cell.date).getDate()}
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}
