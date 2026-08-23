import type { Habit, Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import type { IconName } from '../../../ui/Icon'
import { currentStreak, longestStreak, completionRate } from '../../../lib/streak'
import { diffDays, toIso, todayIso } from '../../../lib/dates'
import { plural } from '../../../lib/plural'
import { Icon } from '../../../ui/Icon'
import styles from './MetricCards.module.css'

/**
 * Четыре плашки с главными цифрами привычки.
 *
 * Устройство плашки одно на все: крупное число, под ним короткая подпись,
 * справа знак. Прежние карточки были устроены по-разному — у одной кольцо,
 * у другой мини-график, у третьей сноска внизу, — и на каждую приходилось
 * смотреть отдельно, разбираясь, что здесь показано.
 *
 * Показатели подобраны так, чтобы отвечать на разные вопросы, а не на один
 * четырьмя способами: «как дела сейчас», «давно ли это со мной», «насколько
 * ровно держу», «а лучший мой результат какой».
 */

interface Props {
  habit: Habit
  /** Отметки того, чьи цифры считаем: свои либо напарника. */
  dates: string[]
  /**
   * С какого дня этот человек ведёт привычку. У создателя — день заведения,
   * у приглашённого — день перехода по ссылке: длительность у каждого своя,
   * и считать её напарнику от рождения привычки было бы неправдой.
   */
  since: string
  lang: Lang
  t: Dict
}

export function MetricCards({ habit, dates, since, lang, t }: Props) {
  const current = currentStreak(dates, habit.schedule)
  const longest = longestStreak(dates, habit.schedule)
  const rate = Math.round(completionRate(dates, habit.schedule, 30) * 100)

  /*
   * Длительность — сколько человек ведёт привычку, от своего первого дня до
   * сегодня. Это не заслуга, а стаж: он растёт сам, даже когда серия
   * прервалась, и в этом его смысл — напомнить, что дело идёт давно и
   * бросать его из-за одного пропуска не стоит.
   *
   * Первый день считается за день, а не за ноль: заведя привычку сегодня,
   * человек видит «1 день», а не пустое место.
   *
   * День берётся местный, а не первые десять знаков отметки времени: там
   * всемирное время, и после полуночи по местному оно ещё вчерашнее.
   * Привычка, заведённая минуту назад, показывала бы «2 дня».
   */
  const age = Math.max(1, diffDays(todayIso(), toIso(new Date(since))) + 1)

  /** Дни или недели — у расписания «N раз в неделю» серия считается неделями. */
  const streakUnit = (value: number) =>
    current.unit === 'weeks'
      ? plural(value, lang, [t.detail.weekOne, t.detail.weekFew, t.detail.weekMany])
      : plural(value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  const days = (value: number) =>
    plural(value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  return (
    <div className={styles.grid} style={{ '--habit': habit.color } as React.CSSProperties}>
      <Metric
        icon="flame"
        value={String(current.value)}
        unit={streakUnit(current.value)}
        label={t.detail.inRow}
      />
      <Metric icon="viewTable" value={String(age)} unit={days(age)} label={t.detail.duration} />
      <Metric icon="chart" value={`${rate}%`} label={t.detail.discipline} />
      <Metric
        icon="trophy"
        value={String(longest.value)}
        unit={streakUnit(longest.value)}
        label={t.detail.record}
      />
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

      {/* Знак справа, как и было, но крупнее: он опознаёт плашку с одного
          взгляда, и на прежнем размере терялся рядом с числом. */}
      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={26} strokeWidth={1.6} />
      </span>
    </section>
  )
}
