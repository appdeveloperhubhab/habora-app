import { useRef } from 'react'
import { hapticSelect } from '../lib/haptics'
import { Toggle } from './Toggle'
import styles from './TimePicker.module.css'

/**
 * Время напоминания: переключатель и поле с часами.
 *
 * Поле — родное для браузера `input type="time"`, а не набор счётчиков вроде
 * `DurationPicker`. Длительность набирают от нуля, и там счётчики к месту, а
 * время суток набирают от произвольного часа: до семнадцати ноль-ноль пришлось
 * бы тапать семнадцать раз. Родное поле открывает привычное колесо телефона,
 * где нужный час выбирается одним движением.
 *
 * Выключенное состояние — `null`, а не нулевое время: полночь — такой же
 * назначенный час, как любой другой, и означать «не напоминать» не может.
 */

/** С чего начинается время, включённое впервые. Утро — самый частый час привычки. */
const DEFAULT_TIME = '09:00'

export function TimePicker({
  value,
  color,
  labels,
  onChange,
}: {
  /** Время `ЧЧ:ММ`; null — не напоминать. */
  value: string | null
  color: string
  labels: { on: string; off: string }
  onChange(next: string | null): void
}) {
  /*
   * Последнее назначенное время переживает выключение переключателя.
   * Иначе задетый по ошибке переключатель стирал бы назначенные 17:00, и
   * вернуть их можно было бы только набрав заново.
   */
  const last = useRef(value ?? DEFAULT_TIME)
  if (value !== null) last.current = value

  return (
    <div className={styles.row}>
      {value === null ? (
        <span className={styles.off}>{labels.off}</span>
      ) : (
        <input
          type="time"
          className={styles.input}
          value={value}
          aria-label={labels.on}
          onChange={(e) => {
            // Пустое поле остаётся у очищенного ввода на пути к новому времени.
            // Считать это выключением значило бы гасить переключатель под рукой
            // у человека, который как раз набирает часы.
            if (e.target.value) onChange(e.target.value)
          }}
        />
      )}

      <Toggle
        checked={value !== null}
        color={color}
        label={labels.on}
        onChange={(on) => {
          hapticSelect()
          onChange(on ? last.current : null)
        }}
      />
    </div>
  )
}
