import { useRef, useState } from 'react'
import type { Habit } from '../../types'
import type { Dict } from '../../i18n'
import { activityGrid } from '../../lib/stats'
import { hapticSelect, hapticTick, hapticUntick } from '../../lib/haptics'
import { HabitIcon } from '../../ui/habitIcons'
import { HabitMembers } from './HabitMembers'
import styles from './HabitCardBoard.module.css'

/**
 * Карточка привычки с сеткой выполнения: иконка с названием сверху, сетка
 * посередине, кнопка «Отметить» внизу.
 *
 * Один компонент на два вида — месяц и год: они отличаются глубиной показанной
 * истории и размером карточки, но не устройством.
 */

/**
 * Сколько недель видно.
 *
 * Месяц — пять недель: столько их помещается в календарный месяц, и в половине
 * ширины экрана они укладываются целиком, без прокрутки.
 *
 * Год — все 53: клетки становятся мелкими, зато год виден целиком. Ради этого
 * вид и нужен — прокручиваемый год ничем не отличался бы от месяца.
 */
const WEEKS = { month: 5, year: 53 } as const

/**
 * Шаг задержки на единицу расстояния от сегодняшней клетки.
 *
 * В неделе волна идёт слева направо, но здесь сетка двумерная, а отмечаемая
 * клетка сидит в её правом краю — проход строкой читался бы как движение мимо
 * места нажатия. Поэтому всплеск расходится кругами от самой клетки: задержка
 * растёт с расстоянием до неё.
 */
const RIPPLE_STEP_MS = 34

interface Props {
  habit: Habit
  dates: string[]
  done: boolean
  size: 'month' | 'year'
  t: Dict
  onToggle(): void
  onOpen(): void
  onLongPress(): void
}

const LONG_PRESS_MS = 480

export function HabitCardBoard({ habit, dates, done, size, t, onToggle, onOpen, onLongPress }: Props) {
  const [pulseKey, setPulseKey] = useState(0)
  const longPressTimer = useRef<number | undefined>(undefined)
  const longPressFired = useRef(false)

  const columns = activityGrid(dates, WEEKS[size])

  const startLongPress = () => {
    longPressFired.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      hapticSelect()
      onLongPress()
    }, LONG_PRESS_MS)
  }

  const handleToggle = () => {
    if (done) hapticUntick()
    else hapticTick()
    // Всплеск, вспышка карточки и ореол кнопки — подтверждение выполненного.
    // При снятии отметки они неуместны: отменять привычку не с чем поздравлять.
    // Тактильный отклик остаётся в обоих случаях — он говорит, что нажатие
    // засчитано, а не хвалит за него.
    if (!done) setPulseKey((key) => key + 1)
    onToggle()
  }

  const flashClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.flashA : styles.flashB

  /*
   * Всплеск перезапускается сменой класса, а не пересозданием клеток по `key`,
   * как это сделано в неделе: новая клетка появилась бы уже закрашенной, и
   * плавная заливка цветом пропала бы — осталось бы одно движение без цвета.
   */
  const rippleClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.rippleA : styles.rippleB

  // Сегодняшняя клетка всегда в последнем столбце — с неё и начинается всплеск.
  const todayRow = columns[columns.length - 1].findIndex((cell) => cell.isToday)

  return (
    <article
      className={[styles.card, styles[size], habit.tinted ? '' : styles.plain, flashClass]
        .filter(Boolean)
        .join(' ')}
      style={{ '--habit': habit.color } as React.CSSProperties}
    >
      <button
        className={styles.body}
        onClick={() => {
          if (!longPressFired.current) onOpen()
        }}
        onPointerDown={startLongPress}
        onPointerUp={() => window.clearTimeout(longPressTimer.current)}
        onPointerLeave={() => window.clearTimeout(longPressTimer.current)}
        onPointerCancel={() => window.clearTimeout(longPressTimer.current)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={habit.name}
      >
        <span className={styles.header}>
          <span className={styles.icon}>
            <HabitIcon icon={habit.icon} size={18} />
          </span>
          <span className={styles.name}>{habit.name}</span>
          {/* В месяце карточка вдвое уже, и лица прижимаются к названию —
              там они мельче, чтобы имя не обрезалось на втором же слове. */}
          <HabitMembers habit={habit} size={size === 'month' ? 16 : 20} />
        </span>

        <span className={styles.cells}>
          {columns.map((week, weekIndex) => (
            <span key={week[0].date} className={styles.week}>
              {week.map((cell, dayIndex) => (
                <span
                  key={cell.date}
                  className={[
                    styles.cell,
                    cell.done ? styles.cellDone : '',
                    cell.isToday ? styles.cellToday : '',
                    cell.isFuture ? styles.cellFuture : '',
                    rippleClass,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    animationDelay: `${
                      Math.hypot(
                        columns.length - 1 - weekIndex,
                        todayRow < 0 ? 0 : todayRow - dayIndex,
                      ) * RIPPLE_STEP_MS
                    }ms`,
                  }}
                />
              ))}
            </span>
          ))}
        </span>
      </button>

      <button className={done ? `${styles.mark} ${styles.markDone}` : styles.mark} onClick={handleToggle}>
        {pulseKey > 0 && <span key={pulseKey} className={styles.glow} />}

        <span className={styles.markIcon}>
          {/* Та же галочка, что и в кнопке недели: pathLength=1 позволяет
              прорисовать её штрихом, не завися от геометрии пути. */}
          <svg className={styles.tick} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5.5 12.5 10 17 18.5 7.5"
              pathLength={1}
              stroke="currentColor"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className={styles.markLabel}>{done ? t.habits.marked : t.habits.mark}</span>
      </button>
    </article>
  )
}
