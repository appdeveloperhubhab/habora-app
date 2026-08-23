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
 * У совместной привычки в каждой плашке стоят цифры всех участников разом —
 * свои и напарника, — а не два отдельных набора по четыре. Так их и сравнивают:
 * взгляд не бегает между блоками, а видит пару чисел рядом. Восемь плашек
 * вместо четырёх заодно вытесняли календарь за нижний край экрана.
 *
 * Цвет числа отличает, чьё оно: своё — цветом привычки, напарника — его
 * собственным, тем же, каким он покрашен во вкладке «Друзья». Одинаковый цвет
 * заставлял бы держать в голове, кто где стоит.
 */

/** Чьи-то цифры по одной привычке. */
export interface MetricPerson {
  key: string
  dates: string[]
  /** С какого дня человек ведёт привычку — от этого считается длительность. */
  since: string
  color: string
}

interface Props {
  habit: Habit
  /** Первым идёт сам человек, дальше напарники — в этом же порядке и числа. */
  people: MetricPerson[]
  lang: Lang
  t: Dict
}

export function MetricCards({ habit, people, lang, t }: Props) {
  const считано = people.map((человек) => {
    const current = currentStreak(человек.dates, habit.schedule)
    return {
      color: человек.color,
      key: человек.key,
      unit: current.unit,
      streak: current.value,
      longest: longestStreak(человек.dates, habit.schedule).value,
      rate: Math.round(completionRate(человек.dates, habit.schedule, 30) * 100),
      /*
       * Длительность — сколько человек ведёт привычку, от своего первого дня
       * до сегодня. Это не заслуга, а стаж: он растёт сам, даже когда серия
       * прервалась, и в этом его смысл — напомнить, что дело идёт давно и
       * бросать его из-за одного пропуска не стоит.
       *
       * День берётся местный, а не первые десять знаков отметки времени: там
       * всемирное время, и после полуночи по местному оно ещё вчерашнее —
       * привычка, заведённая минуту назад, показывала бы «2 дня».
       */
      age: Math.max(1, diffDays(todayIso(), toIso(new Date(человек.since))) + 1),
    }
  })

  /**
   * Единица измерения берётся у первого человека: у расписания «N раз в
   * неделю» серия считается неделями, и она одна на всю привычку.
   */
  const streakUnit = (value: number) =>
    считано[0]?.unit === 'weeks'
      ? plural(value, lang, [t.detail.weekOne, t.detail.weekFew, t.detail.weekMany])
      : plural(value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  const days = (value: number) =>
    plural(value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  /** Подпись под парой чисел берётся по первому: она одна на всю плашку. */
  const первый = считано[0]

  return (
    <div className={styles.grid} style={{ '--habit': habit.color } as React.CSSProperties}>
      <Metric
        icon="flame"
        label={t.detail.inRow}
        unit={первый && streakUnit(первый.streak)}
        values={считано.map((ч) => ({ key: ч.key, color: ч.color, text: String(ч.streak) }))}
      />
      <Metric
        icon="viewTable"
        label={t.detail.duration}
        unit={первый && days(первый.age)}
        values={считано.map((ч) => ({ key: ч.key, color: ч.color, text: String(ч.age) }))}
      />
      <Metric
        icon="chart"
        label={t.detail.discipline}
        values={считано.map((ч) => ({ key: ч.key, color: ч.color, text: `${ч.rate}%` }))}
      />
      <Metric
        icon="trophy"
        label={t.detail.record}
        unit={первый && streakUnit(первый.longest)}
        values={считано.map((ч) => ({ key: ч.key, color: ч.color, text: String(ч.longest) }))}
      />
    </div>
  )
}

/**
 * Одна плашка: числа участников в строку, под ними подпись, справа знак.
 *
 * Единица измерения стоит рядом с числами и меньше их: «5» — то, что читают,
 * «дней» — то, что уточняет, и одинаковый кегль заставлял бы разбирать всю
 * строку целиком. Пишется она один раз на всех: у обоих она одна и та же, а
 * повторённая читалась бы как часть числа.
 */
function Metric({
  icon,
  label,
  unit,
  values,
}: {
  icon: IconName
  label: string
  unit?: string
  values: { key: string; color: string; text: string }[]
}) {
  return (
    <section className={styles.card}>
      <div className={styles.body}>
        <p className={styles.value}>
          {values.map((значение, i) => (
            <span key={значение.key} className={styles.pair}>
              {/* Точка между числами, а не запятая: запятая читается как
                  разряд внутри одного числа. */}
              {i > 0 && <span className={styles.sep} aria-hidden="true" />}
              <span className={styles.number} style={{ color: значение.color }}>
                {значение.text}
              </span>
            </span>
          ))}
          {unit && <span className={styles.unit}>{unit}</span>}
        </p>
        <p className={styles.label}>{label}</p>
      </div>

      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={26} strokeWidth={1.6} />
      </span>
    </section>
  )
}
