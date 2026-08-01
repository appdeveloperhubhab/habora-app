import styles from './DayBars.module.css'

/**
 * Дни недели вертикальными полосками справа от названия привычки.
 *
 * Полоски объёмные, а не плоские заливки: сверху блик, снизу тень, лёгкий
 * градиент по высоте — так они читаются как физические переключатели,
 * а не как элементы диаграммы.
 */

export interface DayBar {
  date: string
  done: boolean
  isToday: boolean
  isFuture: boolean
}

interface Props {
  days: DayBar[]
  color: string
  /**
   * Счётчик отметок. Он входит в `key` полосок, поэтому при каждой новой
   * отметке React пересоздаёт их и CSS-анимация волны запускается заново.
   * Обычный флаг здесь не годится: браузер считает повторную анимацию той же
   * самой и не проигрывает её второй раз.
   */
  pulseKey: number
}

/**
 * Задержка между соседними полосками. Чем она больше, тем неспешнее волна
 * пробегает по неделе: 7 полосок по 70 мс растягивают проход почти на полсекунды.
 */
const WAVE_STEP_MS = 70

export function DayBars({ days, color, pulseKey }: Props) {
  return (
    <div className={styles.row} style={{ '--habit': color } as React.CSSProperties}>
      {days.map((day, index) => (
        <span
          key={`${day.date}:${pulseKey}`}
          className={[
            styles.bar,
            day.done ? styles.done : '',
            day.isToday ? styles.today : '',
            day.isFuture ? styles.future : '',
            pulseKey > 0 ? styles.pulse : '',
          ]
            .filter(Boolean)
            .join(' ')}
          // Задержка по индексу превращает отметку в волну, пробегающую
          // по неделе слева направо.
          style={{ animationDelay: `${index * WAVE_STEP_MS}ms` }}
        />
      ))}
    </div>
  )
}
