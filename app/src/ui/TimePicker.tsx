import { useRef } from 'react'
import { hapticSelect, hapticWarning } from '../lib/haptics'
import { Icon } from './Icon'
import { Toggle } from './Toggle'
import styles from './TimePicker.module.css'

/**
 * Времена напоминаний: переключатель и набор часов.
 *
 * Часов может быть несколько. Воду пьют не один раз в день, и напомнить о ней
 * надо не один раз — раньше время было одно, и привычка с нормой в три раза
 * получала одно напоминание из трёх нужных.
 *
 * Каждый час — плашка с родным для браузера `input type="time"`, а не своя
 * сетка часов. Своя была: двадцать четыре плитки, все на виду. Выглядела она
 * нарядно, но занимала пол-экрана ради выбора, который телефон делает лучше —
 * его колесо человек уже знает по будильнику и по календарю.
 *
 * Само поле при этом не голый текст, а плашка в цвет привычки: родное поле
 * ничем не показывает, что по нему можно нажать, и рядом с переключателем
 * читалось просто подписью к нему.
 *
 * Выключенное состояние — пустой список, а не полночь: полночь такой же
 * назначенный час, как любой другой, и означать «не напоминать» не может.
 */

/** С чего начинается время, включённое впервые. Утро — самый частый час привычки. */
export const DEFAULT_TIME = '09:00'

/**
 * Сколько часов можно назначить одной привычке.
 *
 * Не техническое ограничение: шестое сообщение об одной и той же привычке за
 * день человек уже не читает, а идёт выключать бота.
 */
export const MAX_TIMES = 5

/** Через сколько часов после последнего встаёт добавленный. */
const NEXT_STEP_HOURS = 3

/** Следующее время после последнего назначенного, не перепрыгивая за полночь. */
function nextAfter(times: string[]): string {
  const last = times[times.length - 1]
  if (!last) return DEFAULT_TIME

  const [hours, minutes] = last.split(':').map(Number)
  const next = hours + NEXT_STEP_HOURS
  // За полночь не переносим: ночное напоминание почти наверняка ошибка, а
  // поправить час человек всё равно собирается — пусть правит с вечера.
  const capped = Math.min(next, 23)
  return `${String(capped).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function TimePicker({
  value,
  color,
  labels,
  onChange,
}: {
  /** Назначенные часы; пусто — не напоминать. */
  value: string[]
  color: string
  labels: { on: string; off: string; add: string; remove: string }
  onChange(next: string[]): void
}) {
  /*
   * Последний список переживает выключение переключателя. Иначе задетый по
   * ошибке переключатель стирал бы назначенные 17:00, и вернуть их можно было
   * бы только набрав заново.
   */
  const last = useRef<string[]>(value.length > 0 ? value : [DEFAULT_TIME])
  if (value.length > 0) last.current = value

  const on = value.length > 0

  /** Список всегда по возрастанию и без повторов: два одинаковых часа — это один час. */
  const put = (times: string[]) => onChange([...new Set(times)].sort())

  return (
    <div className={styles.block} style={{ '--habit': color } as React.CSSProperties}>
      <div className={styles.row}>
        {/* Колокольчик гаснет вместе с напоминанием: включено оно или нет,
            видно раньше, чем прочитаны слова рядом. */}
        <span className={on ? `${styles.icon} ${styles.iconOn}` : styles.icon}>
          <Icon name="bell" size={17} />
        </span>

        {on ? (
          <div className={styles.times}>
            {value.map((time, index) => (
              <span key={time} className={styles.pill}>
                <label className={styles.pillLabel}>
                  <input
                    type="time"
                    className={styles.input}
                    value={time}
                    aria-label={labels.on}
                    onChange={(e) => {
                      // Пустое поле остаётся у очищенного ввода на пути к новому
                      // времени. Считать это выключением значило бы гасить
                      // переключатель под рукой у человека, который набирает часы.
                      if (!e.target.value) return
                      put(value.map((item, i) => (i === index ? e.target.value : item)))
                    }}
                  />
                </label>

                {/* Крестик появляется со второго часа: у единственного его роль
                    играет переключатель, и два способа выключить одно и то же
                    рядом только путают. */}
                {value.length > 1 && (
                  <button
                    className={styles.remove}
                    aria-label={labels.remove}
                    onClick={() => {
                      hapticSelect()
                      put(value.filter((_, i) => i !== index))
                    }}
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </span>
            ))}

            {value.length < MAX_TIMES && (
              <button
                className={styles.add}
                aria-label={labels.add}
                onClick={() => {
                  const next = nextAfter(value)
                  // Такой час уже есть — добавлять нечего, но и молчать нельзя:
                  // человек нажал и должен понять, что нажатие дошло.
                  if (value.includes(next)) {
                    hapticWarning()
                    return
                  }
                  hapticSelect()
                  put([...value, next])
                }}
              >
                <Icon name="plus" size={15} />
              </button>
            )}
          </div>
        ) : (
          <span className={styles.off}>{labels.off}</span>
        )}

        <Toggle
          checked={on}
          color={color}
          label={labels.on}
          onChange={(next) => {
            hapticSelect()
            put(next ? last.current : [])
          }}
        />
      </div>
    </div>
  )
}
