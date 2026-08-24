import { useState } from 'react'
import type { Lang } from '../../../types'
import { addMonths, formatMonthYear, fromIso, monthGrid, todayIso, weekdayMin } from '../../../lib/dates'
import { hapticSelect, hapticTick, hapticUntick } from '../../../lib/haptics'
import { Icon } from '../../../ui/Icon'
import { shareFill, type PersonMarks } from '../participants'
import styles from './MonthCalendar.module.css'

/**
 * Календарь месяца. В отличие от сетки активности, которая показывает
 * «сколько», этот блок показывает «когда именно»: у каждой клетки есть число
 * и день недели, чтобы не пересчитывать вручную, на какой день пришлась отметка.
 *
 * У совместной привычки день закрашен долями — по одной на участника, каждая
 * своим цветом. День, который сделали оба, виден сразу двумя половинами: это
 * то, ради чего привычку и ведут вдвоём, и одним цветом такой день ничем не
 * отличался бы от сделанного в одиночку.
 *
 * Здесь же закрываются пропуски: тап по прошедшему дню ставит или снимает
 * отметку задним числом — но только свою. Будущие дни недоступны.
 */

export function MonthCalendar({
  dates,
  partial,
  people,
  color,
  lang,
  onToggleDay,
}: {
  /** Свои отметки: только их и переключает тап по дню. */
  dates: string[]
  /** Свои дни, где норму начали, но не добрали. */
  partial?: Set<string>
  /** Все участники с их отметками — сам человек первым. */
  people: PersonMarks[]
  color: string
  lang: Lang
  onToggleDay(date: string): void
}) {
  const today = todayIso()
  const [month, setMonth] = useState(today)
  const done = new Set(dates)
  const weeks = monthGrid(month)

  // Цвета участников считаем один раз на месяц, а не на каждую из 42 клеток.
  const colors = people.map((человек) => человек.color)

  const shiftMonth = (delta: number) => {
    hapticSelect()
    setMonth((current) => addMonths(current, delta))
  }

  return (
    <section className={styles.card} style={{ '--habit': color } as React.CSSProperties}>
      {/*
        Заголовка «Календарь» здесь нет: под ним и так календарь, и подпись
        называла очевидное, заодно отжимая месяц от середины карточки. Стрелки
        разведены по краям, месяц стоит между ними — так его видно первым,
        а до кнопок легче дотянуться большим пальцем.
      */}
      <header className={styles.header}>
        <button className={styles.navButton} onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" size={18} />
        </button>

        <span className={styles.month}>{formatMonthYear(month, lang)}</span>

        <button
          className={styles.navButton}
          onClick={() => shiftMonth(1)}
          // Листать в будущее незачем: отмечать вперёд нельзя.
          disabled={month.slice(0, 7) >= today.slice(0, 7)}
          aria-label="Next month"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </header>

      <div className={styles.weekdays}>
        {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
          <span key={day} className={styles.weekdayLabel}>
            {weekdayMin(day, lang)}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {weeks.map((week) =>
          week.map((cell) => {
            const isDone = done.has(cell.date)
            const isFuture = cell.date > today

            /*
             * Кто отметил этот день. Порядок тот же, что у плашек с цифрами:
             * сначала сам человек, затем напарники, — и доли в клетке идут
             * в нём же, чтобы свой цвет всегда был с одной стороны.
             */
            const кто = people.map((человек) => человек.marks.has(cell.date))
            const отметилиВсе = кто.length > 1 && кто.every(Boolean)

            return (
              <button
                key={cell.date}
                className={[
                  styles.day,
                  кто.some(Boolean) ? styles.done : '',
                  !isDone && partial?.has(cell.date) ? styles.partial : '',
                  отметилиВсе ? styles.everyone : '',
                  cell.date === today ? styles.today : '',
                  cell.outside ? styles.outside : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ background: shareFill(colors, кто) }}
                disabled={isFuture}
                onClick={() => {
                  if (isDone) hapticUntick()
                  else hapticTick()
                  onToggleDay(cell.date)
                }}
              >
                {fromIso(cell.date).getDate()}
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}
