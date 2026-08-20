import { useRef } from 'react'
import { hapticSelect } from '../lib/haptics'
import { Icon } from './Icon'
import { Toggle } from './Toggle'
import styles from './TimePicker.module.css'

/**
 * Время напоминания: переключатель и поле с часами.
 *
 * Поле — родное для браузера `input type="time"`, а не своя сетка часов.
 * Своя была: двадцать четыре плитки, все на виду. Выглядела она нарядно, но
 * занимала пол-экрана ради выбора, который телефон делает лучше — его колесо
 * человек уже знает по будильнику и по календарю, и крутить его привычнее,
 * чем выцеливать плитку пальцем.
 *
 * Само поле при этом не голый текст, а плашка в цвет привычки: родное поле
 * ничем не показывает, что по нему можно нажать, и рядом с переключателем
 * читалось просто подписью к нему.
 *
 * Выключенное состояние — `null`, а не нулевое время: полночь — такой же
 * назначенный час, как любой другой, и означать «не напоминать» не может.
 */

/** С чего начинается время, включённое впервые. Утро — самый частый час привычки. */
export const DEFAULT_TIME = '09:00'

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

  const on = value !== null

  return (
    <div className={styles.row} style={{ '--habit': color } as React.CSSProperties}>
      {/* Колокольчик гаснет вместе с напоминанием: включено оно или нет,
          видно раньше, чем прочитаны слова рядом. */}
      <span className={on ? `${styles.icon} ${styles.iconOn}` : styles.icon}>
        <Icon name="bell" size={17} />
      </span>

      {on ? (
        <label className={styles.pill}>
          <input
            type="time"
            className={styles.input}
            value={value}
            aria-label={labels.on}
            onChange={(e) => {
              // Пустое поле остаётся у очищенного ввода на пути к новому
              // времени. Считать это выключением значило бы гасить
              // переключатель под рукой у человека, который набирает часы.
              if (e.target.value) onChange(e.target.value)
            }}
          />
        </label>
      ) : (
        <span className={styles.off}>{labels.off}</span>
      )}

      <Toggle
        checked={on}
        color={color}
        label={labels.on}
        onChange={(next) => {
          hapticSelect()
          onChange(next ? last.current : null)
        }}
      />
    </div>
  )
}
