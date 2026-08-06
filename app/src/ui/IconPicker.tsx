import { hapticSelect } from '../lib/haptics'
import { HabitIcon } from './habitIcons'
import { HABIT_ICONS, ICON_PREFIX } from './habitIconSet'
import styles from './IconPicker.module.css'

/**
 * Выбор иконки привычки — сплошная сетка готовых силуэтов.
 *
 * Своего эмодзи с клавиатуры здесь больше нет. Цветные системные смайлики
 * выбивались из строгого набора: рядом в одном списке стояли плоская линейная
 * иконка и трёхмерный жёлтый колобок, и карточки привычек переставали
 * выглядеть одинаково сделанными. Уже сохранённые эмодзи при этом
 * продолжают рисоваться — см. `HabitIcon`.
 */

interface Props {
  value: string
  color: string
  onChange(icon: string): void
}

export function IconPicker({ value, color, onChange }: Props) {
  return (
    <div className={styles.grid} style={{ '--habit': color } as React.CSSProperties}>
      {HABIT_ICONS.map((id) => {
        const icon = `${ICON_PREFIX}${id}`
        return (
          <button
            key={id}
            type="button"
            className={icon === value ? `${styles.icon} ${styles.selected}` : styles.icon}
            onClick={() => {
              hapticSelect()
              onChange(icon)
            }}
            aria-pressed={icon === value}
            aria-label={id}
          >
            <HabitIcon icon={icon} size={22} />
          </button>
        )
      })}
    </div>
  )
}
