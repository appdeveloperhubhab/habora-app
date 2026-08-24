import { useEffect, useRef } from 'react'
import type { Lang } from '../../../types'
import { activityGrid } from '../../../lib/stats'
import { weekdayShort } from '../../../lib/dates'
import styles from './ActivityGrid.module.css'

/**
 * Сетка активности: строки — дни недели, столбцы — недели.
 * Даёт увидеть плотность выполнения за несколько месяцев одним взглядом,
 * не читая ни одной цифры.
 */

const WEEKS_SHOWN = 26

export function ActivityGrid({
  dates,
  partial,
  color,
  lang,
}: {
  dates: string[]
  /** Дни, где норму начали, но не добрали. */
  partial?: Set<string>
  color: string
  lang: Lang
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const columns = activityGrid(dates, WEEKS_SHOWN)

  // Прокручиваем к текущей неделе: интересна она, а не история полугодовой давности.
  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [])

  return (
    <section className={styles.card} style={{ '--habit': color } as React.CSSProperties}>
      <div className={styles.labels}>
        {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
          <span key={day} className={styles.dayLabel}>
            {weekdayShort(day, lang)}
          </span>
        ))}
      </div>

      <div className={styles.scroller} ref={scroller}>
        <div className={styles.grid}>
          {columns.map((week) => (
            <div key={week[0].date} className={styles.week}>
              {week.map((cell) => (
                <span
                  key={cell.date}
                  className={[
                    styles.cell,
                    cell.done ? styles.done : '',
                    !cell.done && partial?.has(cell.date) ? styles.partial : '',
                    cell.isToday ? styles.today : '',
                    cell.isFuture ? styles.future : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={cell.date}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
