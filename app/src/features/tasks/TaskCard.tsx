import { useState } from 'react'
import type { Task } from '../../types'
import { TASK_COLORS } from '../../theme/palette'
import { CheckButton } from '../habits/CheckButton'
import styles from './TaskCard.module.css'

/**
 * Карточка задачи — та же капсульная форма и та же кнопка отметки, что у
 * привычек, но проще по составу: без сетки дней.
 *
 * Цвет несёт единственный смысл — приоритет: янтарный у важных,
 * сине-голубой у обычных. Состояния (просрочена, выполнена) показываются
 * не цветом, а приглушением, иначе значений у цвета стало бы два.
 */

interface Props {
  task: Task
  overdue: boolean
  overdueLabel: string
  onToggle(): void
  onOpen(): void
}

export function TaskCard({ task, overdue, overdueLabel, onToggle, onOpen }: Props) {
  // Счётчик отметок: две одинаковые анимации под разными именами чередуются,
  // иначе повторное нажатие подряд не перезапустило бы вспышку.
  const [pulseKey, setPulseKey] = useState(0)
  const done = task.doneAt !== null

  const handleToggle = () => {
    setPulseKey((key) => key + 1)
    onToggle()
  }

  const flashClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.flashA : styles.flashB
  const color = TASK_COLORS[task.priority]

  return (
    <article
      className={[
        styles.card,
        flashClass,
        done ? styles.done : '',
        overdue ? styles.overdue : '',
        task.priority === 'important' ? styles.important : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--habit': color } as React.CSSProperties}
    >
      <button className={styles.open} onClick={onOpen} aria-label={task.title}>
        <span className={styles.body}>
          <span className={styles.title}>{task.title}</span>
          {(task.time || overdue) && (
            <span className={styles.meta}>
              {task.time && <span className={styles.time}>{task.time}</span>}
              {overdue && <span className={styles.overdueTag}>{overdueLabel}</span>}
            </span>
          )}
        </span>
      </button>

      <CheckButton done={done} color={color} onToggle={handleToggle} />
    </article>
  )
}
