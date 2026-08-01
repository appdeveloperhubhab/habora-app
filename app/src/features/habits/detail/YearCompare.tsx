import { useState } from 'react'
import type { Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import { monthlyCounts, yearsWithData } from '../../../lib/stats'
import { monthShort } from '../../../lib/dates'
import { hapticSelect } from '../../../lib/haptics'
import { Icon } from '../../../ui/Icon'
import styles from './YearCompare.module.css'

/**
 * Сравнение лет: отметки по месяцам за выбранный год.
 *
 * Переключатель года показываем только тогда, когда лет действительно больше
 * одного — у нового пользователя выбирать не из чего, и лишняя кнопка
 * выглядела бы сломанной.
 */
export function YearCompare({
  dates,
  color,
  lang,
  t,
}: {
  dates: string[]
  color: string
  lang: Lang
  t: Dict
}) {
  const years = yearsWithData(dates)
  const [year, setYear] = useState(years[0])

  const counts = monthlyCounts(dates, year)
  const peak = Math.max(1, ...counts)
  const hasData = counts.some((count) => count > 0)
  const index = years.indexOf(year)

  const shiftYear = (delta: number) => {
    const next = years[index + delta]
    if (next === undefined) return
    hapticSelect()
    setYear(next)
  }

  return (
    <section className={styles.card} style={{ '--habit': color } as React.CSSProperties}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>{t.detail.yearCompare}</h3>
          <p className={styles.hint}>{t.detail.yearCompareHint}</p>
        </div>

        {years.length > 1 ? (
          <div className={styles.picker}>
            <button
              className={styles.pickerButton}
              onClick={() => shiftYear(1)}
              disabled={index >= years.length - 1}
              aria-label="Previous year"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className={styles.year}>{year}</span>
            <button
              className={styles.pickerButton}
              onClick={() => shiftYear(-1)}
              disabled={index <= 0}
              aria-label="Next year"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        ) : (
          <span className={styles.yearStatic}>{year}</span>
        )}
      </header>

      {hasData ? (
        <div className={styles.bars}>
          {counts.map((count, monthIndex) => (
            <div key={monthIndex} className={styles.column}>
              <div className={styles.track}>
                <div className={styles.bar} style={{ height: `${Math.max(3, (count / peak) * 100)}%` }} />
              </div>
              <span className={styles.label}>{monthShort(monthIndex, lang).slice(0, 1)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{t.detail.noData}</p>
      )}
    </section>
  )
}
