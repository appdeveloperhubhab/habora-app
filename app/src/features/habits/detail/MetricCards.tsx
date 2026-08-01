import type { Habit, Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import { currentStreak, longestStreak } from '../../../lib/streak'
import { consistency, countInMonth, countInWeek, timeline } from '../../../lib/stats'
import { monthShort } from '../../../lib/dates'
import { plural } from '../../../lib/plural'
import { Icon } from '../../../ui/Icon'
import { RingProgress } from '../../../ui/RingProgress'
import styles from './MetricCards.module.css'

/**
 * Три карточки-метрики под сеткой активности: серия, последовательность
 * и итог текущего месяца.
 */

interface Props {
  habit: Habit
  dates: string[]
  lang: Lang
  t: Dict
}

export function MetricCards({ habit, dates, lang, t }: Props) {
  const current = currentStreak(dates, habit.schedule)
  const longest = longestStreak(dates, habit.schedule)
  const level = consistency(dates, habit.schedule)
  const monthCount = countInMonth(dates)
  const weekCount = countInWeek(dates)

  const unit = (value: number) =>
    current.unit === 'weeks'
      ? plural(value, lang, [t.detail.weekOne, t.detail.weekFew, t.detail.weekMany])
      : plural(value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  const levelLabel =
    level.level === 'high' ? t.detail.levelHigh : level.level === 'medium' ? t.detail.levelMedium : t.detail.levelLow

  // Мини-график в карточке месяца: помесячные суммы за год.
  const months = timeline(dates, 'year', Array.from({ length: 12 }, (_, i) => monthShort(i, lang)))
  const peak = Math.max(1, ...months.map((point) => point.value))

  return (
    <div className={styles.grid} style={{ '--habit': habit.color } as React.CSSProperties}>
      <section className={`${styles.card} ${styles.streak}`}>
        <h3 className={styles.title}>
          <Icon name="flame" size={15} />
          {t.detail.currentStreak}
        </h3>
        <p className={styles.value}>
          <span className={styles.number}>{current.value}</span>
          <span className={styles.unit}>{unit(current.value)}</span>
        </p>
        <p className={styles.footnote}>
          {t.detail.longest}: <strong>{longest.value}</strong>
          {habit.streakGoal !== null && (
            <>
              {' · '}
              {Math.max(0, habit.streakGoal - current.value)} {t.detail.goalProgress}
            </>
          )}
        </p>
      </section>

      <section className={`${styles.card} ${styles.consistency}`}>
        <h3 className={styles.title}>
          <Icon name="chart" size={15} />
          {t.detail.consistency}
        </h3>
        <div className={styles.ring}>
          <RingProgress value={level.ratio} color={habit.color} size={104} thickness={10}>
            <span className={styles.ringLabel}>{levelLabel}</span>
          </RingProgress>
        </div>
      </section>

      <section className={`${styles.card} ${styles.month}`}>
        <h3 className={styles.title}>
          <Icon name="viewTable" size={15} />
          {t.detail.currentMonth}
        </h3>

        <div className={styles.monthBody}>
          <div>
            <p className={styles.value}>
              <span className={styles.number}>{monthCount}</span>
              <span className={styles.unit}>{t.detail.marks}</span>
            </p>
            <p className={styles.footnote}>
              {t.detail.currentWeek}: <strong>{weekCount}</strong>
            </p>
          </div>

          <div className={styles.spark} aria-hidden="true">
            {months.map((point, index) => (
              <span
                key={point.date}
                className={index === new Date().getMonth() ? `${styles.sparkBar} ${styles.sparkNow}` : styles.sparkBar}
                style={{ height: `${Math.max(4, (point.value / peak) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
