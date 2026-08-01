import { useRef, useState } from 'react'
import type { Habit } from '../../types'
import type { Dict } from '../../i18n'
import { activityGrid } from '../../lib/stats'
import { hapticSelect, hapticTick, hapticUntick } from '../../lib/haptics'
import { HabitIcon } from '../../ui/habitIcons'
import { Icon } from '../../ui/Icon'
import styles from './HabitCardBoard.module.css'

/**
 * Крупная карточка привычки: иконка с названием сверху, сетка выполнения
 * посередине, широкая кнопка «Отметить» внизу.
 *
 * Один компонент на два вида — во всю ширину и плиткой по две в ряд:
 * они отличаются только размерами и глубиной истории, а не устройством.
 */

const WEEKS = { month: 13, grid: 7 } as const

interface Props {
  habit: Habit
  dates: string[]
  done: boolean
  size: 'month' | 'grid'
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
    setPulseKey((key) => key + 1)
    onToggle()
  }

  const flashClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.flashA : styles.flashB

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
            <HabitIcon icon={habit.icon} size={size === 'month' ? 18 : 16} />
          </span>
          <span className={styles.name}>{habit.name}</span>
        </span>

        <span className={styles.cells}>
          {columns.map((week) => (
            <span key={week[0].date} className={styles.week}>
              {week.map((cell) => (
                <span
                  key={cell.date}
                  className={[
                    styles.cell,
                    cell.done ? styles.cellDone : '',
                    cell.isToday ? styles.cellToday : '',
                    cell.isFuture ? styles.cellFuture : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </span>
          ))}
        </span>

        {/* Счётчик помещается только в крупных видах — в узкой строке
            подпись под названием должна оставаться одна. */}
        <span className={styles.total}>
          {dates.length} {t.habits.totalMarks}
        </span>
      </button>

      <button className={done ? `${styles.mark} ${styles.markDone}` : styles.mark} onClick={handleToggle}>
        <span className={styles.markIcon}>{done && <Icon name="check" size={14} strokeWidth={3} />}</span>
        {done ? t.habits.marked : t.habits.mark}
      </button>
    </article>
  )
}
