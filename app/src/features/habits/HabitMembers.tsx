import type { Habit } from '../../types'
import { currentUserId } from '../../lib/telegram'
import { Avatar } from '../../ui/Avatar'
import styles from './HabitMembers.module.css'

/**
 * Аватарки тех, с кем привычка общая, — прямо на карточке в списке.
 *
 * Без них совместность видна только на отдельной вкладке, и главный экран
 * ничем не отличается от одиночного приложения: человек не помнит, какие
 * привычки он делит с друзьями, пока не сходит проверить.
 *
 * Свой аватар не показываем: место на карточке дорогое, а то, что вы в своей
 * привычке участвуете, и так известно. Показан тот, ради кого всё затевалось —
 * другой человек.
 *
 * Аватарки заходят друг на друга: так они читаются как одна компания,
 * а не как набор отдельных значков, и занимают меньше места.
 */
export function HabitMembers({ habit, size = 18 }: { habit: Habit; size?: number }) {
  const me = currentUserId()
  const others = (habit.members ?? []).filter((member) => member.userId !== me)

  if (others.length === 0) return null

  return (
    <span className={styles.row} style={{ '--shift': `${Math.round(size / 3)}px` } as React.CSSProperties}>
      {/* Больше трёх лиц в строку не помещается — остальные считаем числом. */}
      {others.slice(0, 3).map((member) => (
        <Avatar key={member.userId} name={member.firstName} photoUrl={member.photoUrl} size={size} />
      ))}
      {others.length > 3 && <span className={styles.more}>+{others.length - 3}</span>}
    </span>
  )
}
