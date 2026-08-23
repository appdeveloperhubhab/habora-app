import { useState } from 'react'
import type { Lang } from '../../../types'
import { addMonths, formatMonthYear, fromIso, monthGrid, todayIso, weekdayMin } from '../../../lib/dates'
import { hapticSelect, hapticTick, hapticUntick } from '../../../lib/haptics'
import { Icon } from '../../../ui/Icon'
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

/** Чьи отметки рисуем в клетках и каким цветом. */
export interface CalendarPerson {
  key: string
  marks: Set<string>
  color: string
}

/**
 * Заливка клетки: по доле на участника, в том же порядке.
 *
 * Доли режутся жёсткими границами, а не переходом: это не градиент, а две
 * краски рядом, и мягкая растушёвка между ними читалась бы как третий цвет.
 * Не отметившийся получает цвет пустого дня — так видно и что день сделан,
 * и кем именно.
 */
function fill(people: CalendarPerson[], кто: boolean[]): string | undefined {
  // Никто не отметил — пусть клетку красит обычное правило из стилей.
  if (!кто.some(Boolean)) return undefined

  // Один участник — сплошная заливка, без лишней возни с долями.
  if (people.length === 1) return people[0].color

  const доля = 100 / people.length
  const части = people.map((человек, i) => {
    const цвет = кто[i] ? человек.color : 'var(--cell-empty)'
    return `${цвет} ${i * доля}% ${(i + 1) * доля}%`
  })
  return `linear-gradient(135deg, ${части.join(', ')})`
}

export function MonthCalendar({
  dates,
  people,
  color,
  lang,
  onToggleDay,
}: {
  /** Свои отметки: только их и переключает тап по дню. */
  dates: string[]
  /** Все участники с их отметками — сам человек первым. */
  people: CalendarPerson[]
  color: string
  lang: Lang
  onToggleDay(date: string): void
}) {
  const today = todayIso()
  const [month, setMonth] = useState(today)
  const done = new Set(dates)
  const weeks = monthGrid(month)

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
                  отметилиВсе ? styles.everyone : '',
                  cell.date === today ? styles.today : '',
                  cell.outside ? styles.outside : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ background: fill(people, кто) }}
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
