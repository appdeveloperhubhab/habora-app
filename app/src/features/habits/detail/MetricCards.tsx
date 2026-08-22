import type { Habit, Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import type { IconName } from '../../../ui/Icon'
import { currentStreak, longestStreak, completionRate } from '../../../lib/streak'
import { monthProgress } from '../../../lib/stats'
import { plural } from '../../../lib/plural'
import { Icon } from '../../../ui/Icon'
import styles from './MetricCards.module.css'

/**
 * Четыре плашки с главными цифрами привычки: серия, рекорд, месяц и процент
 * выполнения.
 *
 * Устройство плашки одно на все: крупное число, под ним короткая подпись,
 * справа иконка. Прежние карточки были устроены по-разному — у одной кольцо,
 * у другой мини-график, у третьей сноска внизу, — и на каждую приходилось
 * смотреть отдельно, разбираясь, что здесь показано. Одинаковые читаются
 * одним взглядом по всем четырём.
 *
 * Из показателей ушла качественная оценка «высокий / средний / низкий»:
 * слово ничего не говорит о том, много это или мало и что делать дальше.
 * Вместо неё процент, а вместо голого числа отметок за месяц — сколько их
 * из положенного.
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
  const month = monthProgress(dates, habit.schedule)
  const rate = Math.round(completionRate(dates, habit.schedule, 30) * 100)

  /** Дни или недели — у расписания «N раз в неделю» серия считается неделями. */
  const unit = (value: number) =>
    current.unit === 'weeks'
      ? plural(value, lang, [t.detail.weekOne, t.detail.weekFew, t.detail.weekMany])
      : plural(value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  return (
    <div className={styles.grid} style={{ '--habit': habit.color } as React.CSSProperties}>
      <Metric icon="flame" value={String(current.value)} unit={unit(current.value)} label={t.detail.inRow} />
      <Metric icon="trophy" value={String(longest.value)} unit={unit(longest.value)} label={t.detail.record} />
      <Metric
        icon="viewMonth"
        value={String(month.done)}
        unit={`${t.detail.outOf} ${month.planned}`}
        label={t.detail.currentMonth}
      />
      <Metric icon="chart" value={`${rate}%`} label={t.detail.completion} />
    </div>
  )
}

/**
 * Одна плашка. Единица измерения стоит рядом с числом и меньше его: «5» —
 * то, что читают, «дней» — то, что уточняет, и одинаковый кегль заставлял бы
 * разбирать всю строку целиком.
 */
function Metric({
  icon,
  value,
  unit,
  label,
}: {
  icon: IconName
  value: string
  unit?: string
  label: string
}) {
  return (
    <section className={styles.card}>
      <div className={styles.body}>
        <p className={styles.value}>
          <span className={styles.number}>{value}</span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </p>
        <p className={styles.label}>{label}</p>
      </div>

      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
    </section>
  )
}
