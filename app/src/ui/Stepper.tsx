import { hapticSelect } from '../lib/haptics'
import { Icon } from './Icon'
import styles from './Stepper.module.css'

/**
 * Числовое поле с кнопками «минус» и «плюс».
 *
 * Ноль отображается прочерком и по смыслу означает «не задано» — так
 * не нужен отдельный переключатель рядом с каждым необязательным числом.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange(value: number): void
}) {
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta))
    if (next === value) return
    hapticSelect()
    onChange(next)
  }

  return (
    <div className={styles.stepper}>
      <span className={styles.label}>{label}</span>
      <div className={styles.controls}>
        <button className={styles.button} onClick={() => change(-step)} disabled={value <= min}>
          <Icon name="minus" size={16} />
        </button>
        <span className={styles.value}>{value === 0 ? '—' : value}</span>
        <button className={styles.button} onClick={() => change(step)} disabled={value >= max}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}
