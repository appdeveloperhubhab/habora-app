import type { Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import { weekdayCounts, workWeekendSplit } from '../../../lib/stats'
import { weekdayShort } from '../../../lib/dates'
import { RingProgress } from '../../../ui/RingProgress'
import styles from './WeekdaysBlock.module.css'

/**
 * «Будни»: в какие дни недели привычка выполняется чаще.
 *
 * Слева кольцо с соотношением рабочих дней и выходных, справа столбцы по дням.
 * Отсюда видно системные провалы — например, что срывы всегда приходятся
 * на понедельник, а не случаются как попало.
 */
export function WeekdaysBlock({
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
  const counts = weekdayCounts(dates)
  const split = workWeekendSplit(dates)
  const peak = Math.max(1, ...counts)
  const hasData = counts.some((count) => count > 0)

  return (
    <section className={styles.card} style={{ '--habit': color } as React.CSSProperties}>
      <h3 className={styles.title}>{t.detail.weekdays}</h3>
      <p className={styles.hint}>{t.detail.weekdaysHint}</p>

      {hasData ? (
        <div className={styles.body}>
          <div className={styles.ringSide}>
            <RingProgress value={split.workPercent / 100} color={color} size={88} thickness={9}>
              <span className={styles.ringValue}>{split.workPercent}%</span>
            </RingProgress>

            <ul className={styles.legend}>
              <li>
                <span className={styles.dot} style={{ background: color }} />
                <span>
                  {t.detail.workDays}
                  <strong>{split.workPercent} %</strong>
                </span>
              </li>
              <li>
                <span className={styles.dot} style={{ background: 'var(--surface-3)' }} />
                <span>
                  {t.detail.weekend}
                  <strong>{split.weekendPercent} %</strong>
                </span>
              </li>
            </ul>
          </div>

          <div className={styles.bars}>
            {counts.map((count, index) => (
              <div key={index} className={styles.barColumn}>
                <div className={styles.barTrack}>
                  <div
                    className={index >= 5 ? `${styles.bar} ${styles.barWeekend}` : styles.bar}
                    style={{ height: `${Math.max(3, (count / peak) * 100)}%` }}
                  />
                </div>
                <span className={styles.barLabel}>{weekdayShort(index as 0, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.empty}>{t.detail.noData}</p>
      )}
    </section>
  )
}
