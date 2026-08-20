import { hapticSelect } from '../lib/haptics'
import { Toggle } from './Toggle'
import styles from './TimePicker.module.css'

/**
 * Время напоминания: переключатель, крупное значение и выбор касанием.
 *
 * Раньше здесь стояло родное поле `input type="time"`. Оно открывало колесо
 * поверх экрана — чужое приложению по виду, разное на каждом телефоне, и
 * чтобы добраться до часа, его приходилось крутить. Теперь все часы разложены
 * сеткой и видны разом: нужный ставится одним касанием.
 *
 * Прокрутки вбок нет намеренно — по той же причине, по какой её нет у выбора
 * цвета: она прячет половину значений за краем экрана, и выбор превращается
 * в перебор вслепую.
 *
 * Выключенное состояние — `null`, а не нулевое время: полночь — такой же
 * назначенный час, как любой другой, и означать «не напоминать» не может.
 */

/** Часы разложены по шесть в ряд — строка выходит частью суток. */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/**
 * Минуты — четвертями часа.
 *
 * Точность до минуты напоминанию не нужна: разница между «в 17:00» и «в 17:07»
 * не значит ничего, а выбор из шестидесяти значений стоил бы отдельного экрана.
 */
const MINUTES = [0, 15, 30, 45]

/** С чего начинается время, включённое впервые. Утро — самый частый час привычки. */
export const DEFAULT_TIME = '09:00'

const pad = (value: number) => String(value).padStart(2, '0')

export function TimePicker({
  value,
  color,
  labels,
  onChange,
}: {
  /** Время `ЧЧ:ММ`; null — не напоминать. */
  value: string | null
  color: string
  labels: { on: string; off: string; hours: string; minutes: string }
  onChange(next: string | null): void
}) {
  const [hour, minute] = value ? value.split(':').map(Number) : [null, null]

  const set = (nextHour: number, nextMinute: number) => {
    hapticSelect()
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`)
  }

  return (
    <div className={styles.wrap} style={{ '--habit': color } as React.CSSProperties}>
      <div className={styles.head}>
        <span className={value === null ? styles.off : styles.value}>{value ?? labels.off}</span>
        <Toggle
          checked={value !== null}
          color={color}
          label={labels.on}
          onChange={(on) => {
            hapticSelect()
            onChange(on ? DEFAULT_TIME : null)
          }}
        />
      </div>

      {/* Выключено — сетку не показываем: выбирать нечего, а место она
          занимает вчетверо больше самой строки с переключателем. */}
      {value !== null && (
        <>
          <span className={styles.caption}>{labels.hours}</span>
          <div className={styles.hours}>
            {HOURS.map((item) => (
              <button
                key={item}
                type="button"
                className={item === hour ? `${styles.cell} ${styles.on}` : styles.cell}
                onClick={() => set(item, minute ?? 0)}
                aria-pressed={item === hour}
              >
                {item}
              </button>
            ))}
          </div>

          <span className={styles.caption}>{labels.minutes}</span>
          <div className={styles.minutes}>
            {MINUTES.map((item) => (
              <button
                key={item}
                type="button"
                className={item === minute ? `${styles.cell} ${styles.on}` : styles.cell}
                onClick={() => set(hour ?? 9, item)}
                aria-pressed={item === minute}
              >
                :{pad(item)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
