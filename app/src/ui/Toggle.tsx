import { hapticSelect } from '../lib/haptics'
import styles from './Toggle.module.css'

/** Переключатель в стиле системных настроек телефона. */
export function Toggle({
  checked,
  color,
  onChange,
  label,
}: {
  checked: boolean
  /** Цвет включённого состояния; по умолчанию — акцент приложения. */
  color?: string
  onChange(next: boolean): void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? `${styles.track} ${styles.on}` : styles.track}
      style={color ? ({ '--toggle': color } as React.CSSProperties) : undefined}
      onClick={() => {
        hapticSelect()
        onChange(!checked)
      }}
    >
      <span className={styles.knob} />
    </button>
  )
}
