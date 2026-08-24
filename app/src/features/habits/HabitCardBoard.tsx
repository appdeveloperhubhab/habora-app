import { useMemo, useRef, useState } from 'react'
import type { Habit } from '../../types'
import type { Dict } from '../../i18n'
import { activityGrid } from '../../lib/stats'
import { hapticSelect, hapticTick, hapticUntick } from '../../lib/haptics'
import { HabitIcon } from '../../ui/habitIcons'
import { HabitMembers } from './HabitMembers'
import { NO_PARTNERS, shareFill, type PersonMarks } from './participants'
import styles from './HabitCardBoard.module.css'

/** Общий пустой набор: у привычки без нормы недобранных дней не бывает. */
const NO_PARTIAL: Set<string> = new Set()

/**
 * Карточка привычки с сеткой выполнения: иконка с названием сверху, сетка
 * посередине, кнопка «Отметить» внизу.
 *
 * Один компонент на два вида — месяц и год: они отличаются глубиной показанной
 * истории и размером карточки, но не устройством.
 *
 * У совместной привычки клетка делится по диагонали — по доле на участника,
 * каждая своим цветом, как в календаре внутри привычки. День, закрытый обоими,
 * виден двумя красками сразу.
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
 * За сколько волна добегает от сегодняшней клетки до самой дальней.
 *
 * В неделе волна идёт слева направо, но здесь сетка двумерная, а отмечаемая
 * клетка сидит в её правом краю — проход строкой читался бы как движение мимо
 * места нажатия. Поэтому всплеск расходится кругами от самой клетки.
 *
 * Задано время прохода целиком, а не задержка между соседями: в месяце клеток
 * 35, в году 399, и при общем шаге волна в году шла бы вчетверо дольше — она
 * докатывалась бы до дальнего угла, когда о нажатии уже забыли. Здесь же обе
 * сетки проходятся за одно и то же время, примерно как неделя (6 × 70 мс).
 */
const RIPPLE_SPREAD_MS = 460

interface Props {
  habit: Habit
  dates: string[]
  /** С кем привычка общая — их отметки красят свою долю клетки. */
  partners?: PersonMarks[]
  /** Дни, в которые норму начали, но не добрали. */
  partial?: Set<string>
  done: boolean
  /** Сколько раз выполнено сегодня — у привычки с нормой на день. */
  count?: number
  size: 'month' | 'year'
  t: Dict
  onToggle(): void
  onOpen(): void
  onLongPress(): void
}

const LONG_PRESS_MS = 480

export function HabitCardBoard({
  habit,
  dates,
  partners = NO_PARTNERS,
  partial = NO_PARTIAL,
  done,
  count = 0,
  size,
  t,
  onToggle,
  onOpen,
  onLongPress,
}: Props) {
  const [pulseKey, setPulseKey] = useState(0)
  const longPressTimer = useRef<number | undefined>(undefined)
  const longPressFired = useRef(false)

  /*
   * Сетка пересобирается, только когда изменились сами отметки. Отметка на
   * соседней карточке перерисовывает весь список, а в году клеток четыре
   * сотни — считать их заново ради чужой отметки значит ощутимо подтормозить
   * ровно в тот момент, когда палец на кнопке.
   */
  const bands = useMemo(() => {
    const columns = activityGrid(dates, WEEKS[size])

    // Год идёт полосами, месяц — одной сеткой. Ранние недели сверху, недавние
    // снизу: читается сверху вниз, и сегодняшний день оказывается в конце.
    if (size !== 'year') return [columns]

    const split: (typeof columns)[] = []
    for (let start = 0; start < columns.length; start += BAND_WEEKS) {
      split.push(columns.slice(start, start + BAND_WEEKS))
    }
    return split
  }, [dates, size])

  /*
   * Цвета долей: свой первым — цветом привычки, каким клетка красилась и в
   * одиночку. Считается отдельно и запоминается, потому что входит в сетку:
   * новый список на каждую отрисовку заставлял бы пересобирать все клетки,
   * а в году их четыре сотни.
   */
  const colors = useMemo(
    () => (partners.length > 0 ? [habit.color, ...partners.map((человек) => человек.color)] : []),
    [habit.color, partners],
  )

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
    const closes = !done && count + 1 >= habit.target
    // Всплеск, вспышка карточки и ореол кнопки — подтверждение выполненного.
    // При снятии отметки они неуместны: отменять привычку не с чем поздравлять.
    // Тактильный отклик остаётся в обоих случаях — он говорит, что нажатие
    // засчитано, а не хвалит за него.
    if (closes) setPulseKey((key) => key + 1)
    onToggle()
  }

  const flashClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.flashA : styles.flashB

  /*
   * Всплеск перезапускается сменой класса, а не пересозданием клеток по `key`,
   * как это сделано в неделе: новая клетка появилась бы уже закрашенной, и
   * плавная заливка цветом пропала бы — осталось бы одно движение без цвета.
   */
  const rippleClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.rippleA : styles.rippleB

  /*
   * Откуда расходится волна и докуда ей идти.
   *
   * Считается в тех координатах, в которых человек видит сетку, а не по номеру
   * недели в истории. Для года это принципиально: недели разложены полосами,
   * и сороковая лежит не «далеко справа» от сегодняшней, а прямо над ней.
   * По номеру в истории волна проходила бы одну нижнюю полосу, а две верхние
   * дёргались бы разом — что и было видно.
   *
   * Ось недель у месяца идёт сверху вниз, а у года слева направо, но обе
   * координаты входят в расстояние одинаково, поэтому разбирать эти случаи
   * порознь не нужно.
   */
  const lastBand = bands[bands.length - 1]
  const todayRow = lastBand[lastBand.length - 1].findIndex((cell) => cell.isToday)
  const todayWeek = lastBand.length - 1
  const todayDay = (bands.length - 1) * 7 + Math.max(todayRow, 0)
  const lastDay = bands.length * 7 - 1

  // Расстояние до самого дальнего угла: по нему нормируются все задержки,
  // чтобы волна проходила и месяц, и год за одно и то же время.
  const reach = Math.hypot(todayWeek, Math.max(todayDay, lastDay - todayDay)) || 1

  /*
   * Готовая разметка сетки запоминается целиком. Пока отметки и всплеск те же,
   * React получает ту же самую ветку и не разбирает её заново — а разбирать
   * там четыре сотни клеток. Именно на этом уходило около ста миллисекунд при
   * каждом нажатии, в том числе на карточках, которых оно не касалось.
   */
  const grid = useMemo(
    () => (
      <span className={styles.bands}>
        {bands.map((band, bandIndex) => (
          <span key={band[0][0].date} className={styles.cells}>
            {band.map((week, weekInBand) => (
              <span key={week[0].date} className={styles.week}>
                {week.map((cell, dayIndex) => {
                  // Кто отметил этот день: сам человек первым, дальше напарники —
                  // в том же порядке идут и доли клетки.
                  const кто =
                    colors.length > 0
                      ? [cell.done, ...partners.map((человек) => человек.marks.has(cell.date))]
                      : []

                  return (
                    <span
                      key={cell.date}
                      className={[
                        styles.cell,
                        (colors.length > 0 ? кто.some(Boolean) : cell.done) ? styles.cellDone : '',
                        !cell.done && partial.has(cell.date) ? styles.cellPartial : '',
                        cell.isToday ? styles.cellToday : '',
                        cell.isFuture ? styles.cellFuture : '',
                        rippleClass,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        animationDelay: `${Math.round(
                          (Math.hypot(todayWeek - weekInBand, todayDay - (bandIndex * 7 + dayIndex)) /
                            reach) *
                            RIPPLE_SPREAD_MS,
                        )}ms`,
                        // Незакрашенная доля берёт цвет пустой клетки этой же
                        // сетки — он подмешан к цвету привычки, и общий серый
                        // выглядел бы на карточке чужим.
                        background:
                          colors.length > 0
                            ? shareFill(colors, кто, { empty: 'var(--cell-blank)' })
                            : undefined,
                      }}
                    />
                  )
                })}
              </span>
            ))}
          </span>
        ))}
      </span>
    ),
    [bands, colors, partners, partial, rippleClass, todayWeek, todayDay, reach],
  )

  return (
    <article
      className={[styles.card, styles[size], habit.tinted ? '' : styles.plain, flashClass]
        .filter(Boolean)
        .join(' ')}
      style={{ '--habit': habit.color } as React.CSSProperties}
    >
      {/* Слой во всю карточку, как и у недельной: отступы по краям и зазор над
          кнопкой отметки раньше не отзывались на тап, хотя выглядели её частью. */}
      <button
        className={styles.open}
        onClick={() => {
          if (!longPressFired.current) onOpen()
        }}
        onPointerDown={startLongPress}
        onPointerUp={() => window.clearTimeout(longPressTimer.current)}
        onPointerLeave={() => window.clearTimeout(longPressTimer.current)}
        onPointerCancel={() => window.clearTimeout(longPressTimer.current)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={habit.name}
      />

      <span className={styles.body}>
        <span className={styles.header}>
          <span className={styles.icon}>
            <HabitIcon icon={habit.icon} size={18} />
          </span>
          <span className={styles.name}>{habit.name}</span>
          {/* В месяце карточка вдвое уже, и лица прижимаются к названию —
              там они мельче, чтобы имя не обрезалось на втором же слове. */}
          <HabitMembers habit={habit} size={size === 'month' ? 16 : 20} />
        </span>

        {grid}
      </span>

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

        <span className={styles.markLabel}>
          {done ? t.habits.marked : t.habits.mark}
          {/* У привычки с нормой рядом с подписью — сколько уже сделано:
              на плитке кольца долей не видно, кнопка здесь другая. */}
          {habit.target > 1 && (
            <span className={styles.markCount}>
              {t.habits.ofTarget.replace('{done}', String(count)).replace('{target}', String(habit.target))}
            </span>
          )}
        </span>
      </button>
    </article>
  )
}
