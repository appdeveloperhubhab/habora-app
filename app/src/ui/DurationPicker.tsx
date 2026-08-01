import { hapticSelect } from '../lib/haptics'
import { Icon } from './Icon'
import styles from './DurationPicker.module.css'

/**
 * Выбор длительности отдельно минутами и секундами.
 *
 * Один общий счётчик в минутах не годился: «планка 40 секунд» и «медитация
 * 10 минут» — обе нормальные привычки, а шаг в пять минут не давал задать
 * первую вовсе. Здесь минуты и секунды набираются независимо.
 *
 * Ноль в обоих полях означает «без таймера» — отдельный переключатель не нужен.
 */
export function DurationPicker({
  value,
  labels,
  onChange,
}: {
  /** Полная длительность в секундах; null — таймер выключен. */
  value: number | null
  labels: { minutes: string; seconds: string; off: string }
  onChange(next: number | null): void
}) {
  const total = value ?? 0
  const minutes = Math.floor(total / 60)
  const seconds = total % 60

  const apply = (nextMinutes: number, nextSeconds: number) => {
    hapticSelect()
    const next = nextMinutes * 60 + nextSeconds
    onChange(next === 0 ? null : next)
  }

  return (
    <div className={styles.wrap}>
      <Unit
        label={labels.minutes}
        value={minutes}
        max={180}
        step={1}
        onChange={(next) => apply(next, seconds)}
      />
      <Unit
        label={labels.seconds}
        value={seconds}
        max={55}
        // Секунды набираются пятёрками: точность до одной секунды здесь
        // не нужна, а тапать по кнопке пятьдесят раз — мучение.
        step={5}
        onChange={(next) => apply(minutes, next)}
      />

      {value === null && <p className={styles.off}>{labels.off}</p>}
    </div>
  )
}

function Unit({
  label,
  value,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  max: number
  step: number
  onChange(value: number): void
}) {
  const change = (delta: number) => {
    // По кругу: с нуля вниз попадаем на максимум, с максимума вверх — на ноль.
    // Так до «55 секунд» доходишь одним нажатием, а не одиннадцатью.
    const next = value + delta
    if (next < 0) onChange(Math.floor(max / step) * step)
    else if (next > max) onChange(0)
    else onChange(next)
  }

  return (
    <div className={styles.unit}>
      <button className={styles.button} onClick={() => change(-step)} aria-label={`− ${label}`}>
        <Icon name="minus" size={16} />
      </button>

      <span className={styles.value}>
        <span className={styles.number}>{value}</span>
        <span className={styles.label}>{label}</span>
      </span>

      <button className={styles.button} onClick={() => change(step)} aria-label={`+ ${label}`}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
