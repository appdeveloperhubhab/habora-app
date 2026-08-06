import { useRef, useState } from 'react'
import type { Habit } from '../../types'
import type { Dict } from '../../i18n'
import { activityGrid } from '../../lib/stats'
import { hapticSelect, hapticTick, hapticUntick } from '../../lib/haptics'
import { HabitIcon } from '../../ui/habitIcons'
import { HabitMembers } from './HabitMembers'
import styles from './HabitCardBoard.module.css'

/**
 * Карточка привычки с сеткой выполнения: иконка с названием сверху, сетка
 * посередине, кнопка «Отметить» внизу.
 *
 * Один компонент на два вида — месяц и год: они отличаются глубиной показанной
 * истории и размером карточки, но не устройством.
 */

/**
 * Сколько недель видно.
 *
 * Месяц — пять недель: столько их помещается в календарный месяц, и в половине
 * ширины экрана они укладываются целиком, без прокрутки.
 *
 * Год — 57: это чуть больше года, зато делится нацело на три полосы по
 * `BAND_WEEKS` недель. При 53 последняя полоса вышла бы короче остальных,
 * клетки в ней — шире, и столбцы полос перестали бы совпадать по вертикали.
 */
const WEEKS = { month: 5, year: 57 } as const

/**
 * Сколько недель в одной полосе года.
 *
 * Год разложен на три полосы, а не показан одной строкой: в строку ширина
 * карточки делится на все 57 недель, и от клетки остаётся булавочная головка.
 * На 19 недель делителей втрое меньше — клетка выходит около 13,5 пикселя,
 * а год по-прежнему виден целиком, без прокрутки.
 *
 * Именно 19: столько столбцов в доске, взятой за образец, и при зазоре в три
 * пикселя они дают ровно ту же клетку, что там. Одна полоса — точная её копия,
 * а полос три, потому что образец показывал четыре месяца, а тут нужен год.
 *
 * Плата за это — высокая карточка: на экран их помещается примерно одна.
 * Так и задумано: год — самый дальний из трёх видов, его смотрят по одной
 * привычке, а не пролистывают.
 */
const BAND_WEEKS = 19

/**
 * Шаг задержки на единицу расстояния от сегодняшней клетки.
 *
 * В неделе волна идёт слева направо, но здесь сетка двумерная, а отмечаемая
 * клетка сидит в её правом краю — проход строкой читался бы как движение мимо
 * места нажатия. Поэтому всплеск расходится кругами от самой клетки: задержка
 * растёт с расстоянием до неё.
 */
const RIPPLE_STEP_MS = 34

/**
 * Докуда всплеск ещё расходится. Дальние клетки трогаются все разом, вместе
 * с последней волной.
 *
 * Без предела круги шли бы до самого края года — это полторы секунды после
 * нажатия, и волна докатывалась бы до противоположного угла, когда о ней уже
 * забыли. Отклик должен закончиться, пока палец не убран.
 */
const RIPPLE_REACH = 12

interface Props {
  habit: Habit
  dates: string[]
  done: boolean
  size: 'month' | 'year'
  t: Dict
  onToggle(): void
  onOpen(): void
  onLongPress(): void
}

const LONG_PRESS_MS = 480

export function HabitCardBoard({ habit, dates, done, size, t, onToggle, onOpen, onLongPress }: Props) {
  const [pulseKey, setPulseKey] = useState(0)
  const longPressTimer = useRef<number | undefined>(undefined)
  const longPressFired = useRef(false)

  const columns = activityGrid(dates, WEEKS[size])

  // Год идёт полосами, месяц — одной сеткой. Ранние недели сверху, недавние
  // снизу: читается сверху вниз, и сегодняшний день оказывается в конце.
  const bands: (typeof columns)[] = []
  if (size === 'year') {
    for (let start = 0; start < columns.length; start += BAND_WEEKS) {
      bands.push(columns.slice(start, start + BAND_WEEKS))
    }
  } else {
    bands.push(columns)
  }

  const startLongPress = () => {
    longPressFired.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      hapticSelect()
      onLongPress()
    }, LONG_PRESS_MS)
  }

  const handleToggle = () => {
    if (done) hapticUntick()
    else hapticTick()
    // Всплеск, вспышка карточки и ореол кнопки — подтверждение выполненного.
    // При снятии отметки они неуместны: отменять привычку не с чем поздравлять.
    // Тактильный отклик остаётся в обоих случаях — он говорит, что нажатие
    // засчитано, а не хвалит за него.
    if (!done) setPulseKey((key) => key + 1)
    onToggle()
  }

  const flashClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.flashA : styles.flashB

  /*
   * Всплеск перезапускается сменой класса, а не пересозданием клеток по `key`,
   * как это сделано в неделе: новая клетка появилась бы уже закрашенной, и
   * плавная заливка цветом пропала бы — осталось бы одно движение без цвета.
   */
  const rippleClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.rippleA : styles.rippleB

  // Сегодняшняя клетка всегда в последнем столбце — с неё и начинается всплеск.
  const todayRow = columns[columns.length - 1].findIndex((cell) => cell.isToday)

  return (
    <article
      className={[styles.card, styles[size], habit.tinted ? '' : styles.plain, flashClass]
        .filter(Boolean)
        .join(' ')}
      style={{ '--habit': habit.color } as React.CSSProperties}
    >
      <button
        className={styles.body}
        onClick={() => {
          if (!longPressFired.current) onOpen()
        }}
        onPointerDown={startLongPress}
        onPointerUp={() => window.clearTimeout(longPressTimer.current)}
        onPointerLeave={() => window.clearTimeout(longPressTimer.current)}
        onPointerCancel={() => window.clearTimeout(longPressTimer.current)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={habit.name}
      >
        <span className={styles.header}>
          <span className={styles.icon}>
            <HabitIcon icon={habit.icon} size={18} />
          </span>
          <span className={styles.name}>{habit.name}</span>
          {/* В месяце карточка вдвое уже, и лица прижимаются к названию —
              там они мельче, чтобы имя не обрезалось на втором же слове. */}
          <HabitMembers habit={habit} size={size === 'month' ? 16 : 20} />
        </span>

        <span className={styles.bands}>
          {bands.map((band, bandIndex) => (
            <span key={band[0][0].date} className={styles.cells}>
              {band.map((week, weekInBand) => {
                // Расстояние до сегодняшней клетки считается по всей истории,
                // а не внутри полосы: иначе волна начиналась бы заново
                // в каждой из них, и вместо одного всплеска их было бы два.
                const weekIndex = bandIndex * BAND_WEEKS + weekInBand

                return (
                  <span key={week[0].date} className={styles.week}>
                    {week.map((cell, dayIndex) => (
                      <span
                        key={cell.date}
                        className={[
                          styles.cell,
                          cell.done ? styles.cellDone : '',
                          cell.isToday ? styles.cellToday : '',
                          cell.isFuture ? styles.cellFuture : '',
                          rippleClass,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{
                          animationDelay: `${
                            Math.min(
                              Math.hypot(
                                columns.length - 1 - weekIndex,
                                todayRow < 0 ? 0 : todayRow - dayIndex,
                              ),
                              RIPPLE_REACH,
                            ) * RIPPLE_STEP_MS
                          }ms`,
                        }}
                      />
                    ))}
                  </span>
                )
              })}
            </span>
          ))}
        </span>
      </button>

      <button className={done ? `${styles.mark} ${styles.markDone}` : styles.mark} onClick={handleToggle}>
        {pulseKey > 0 && <span key={pulseKey} className={styles.glow} />}

        <span className={styles.markIcon}>
          {/* Та же галочка, что и в кнопке недели: pathLength=1 позволяет
              прорисовать её штрихом, не завися от геометрии пути. */}
          <svg className={styles.tick} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5.5 12.5 10 17 18.5 7.5"
              pathLength={1}
              stroke="currentColor"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className={styles.markLabel}>{done ? t.habits.marked : t.habits.mark}</span>
      </button>
    </article>
  )
}
