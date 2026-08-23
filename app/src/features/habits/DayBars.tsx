import { NO_PARTNERS, shareFill, type PersonMarks } from './participants'
import styles from './DayBars.module.css'

/**
 * Дни недели вертикальными полосками справа от названия привычки.
 *
 * Полоски объёмные, а не плоские заливки: сверху блик, снизу тень, лёгкий
 * градиент по высоте — так они читаются как физические переключатели,
 * а не как элементы диаграммы.
 *
 * У совместной привычки полоска делится по числу участников: верхняя половина
 * ваша, нижняя — напарника, каждая своим цветом. День, закрытый обоими, виден
 * двумя красками сразу — иначе на главном экране совместная привычка ничем не
 * отличалась бы от одиночной.
 */

export interface DayBar {
  date: string
  done: boolean
  isToday: boolean
  isFuture: boolean
}

interface Props {
  days: DayBar[]
  color: string
  /**
   * С кем привычка общая. Пусто — привычка одиночная, и полоски целиком
   * красит обычное правило из стилей.
   */
  partners?: PersonMarks[]
  /**
   * Счётчик отметок. Он входит в `key` полосок, поэтому при каждой новой
   * отметке React пересоздаёт их и CSS-анимация волны запускается заново.
   * Обычный флаг здесь не годится: браузер считает повторную анимацию той же
   * самой и не проигрывает её второй раз.
   */
  pulseKey: number
}

/**
 * Задержка между соседними полосками. Чем она больше, тем неспешнее волна
 * пробегает по неделе: 7 полосок по 70 мс растягивают проход почти на полсекунды.
 */
const WAVE_STEP_MS = 70

export function DayBars({ days, color, partners = NO_PARTNERS, pulseKey }: Props) {
  /*
   * Цвета долей: свой первым — тем же цветом привычки, каким полоска красилась
   * и в одиночку. Порядок тот же, что у цифр на экране привычки, чтобы своё
   * всегда было с одной стороны.
   */
  const colors = partners.length > 0 ? [color, ...partners.map((человек) => человек.color)] : []

  return (
    // Корень — span, а не div: у друзей строка привычки сама по себе кнопка,
    // а блочный элемент внутри кнопки разметка не допускает.
    <span className={styles.row} style={{ '--habit': color } as React.CSSProperties}>
      {days.map((day, index) => {
        const кто = colors.length > 0 ? [day.done, ...partners.map((ч) => ч.marks.has(day.date))] : []

        return (
          <span
            key={`${day.date}:${pulseKey}`}
            className={[
              styles.bar,
              (colors.length > 0 ? кто.some(Boolean) : day.done) ? styles.done : '',
              day.isToday ? styles.today : '',
              day.isFuture ? styles.future : '',
              pulseKey > 0 ? styles.pulse : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              // Задержка по индексу превращает отметку в волну, пробегающую
              // по неделе слева направо.
              animationDelay: `${index * WAVE_STEP_MS}ms`,
              /*
               * Деление сверху вниз, а не по диагонали, как в квадратных
               * клетках: полоска узкая и высокая, и косая черта прошла бы по
               * ней почти горизонтально — читалась бы как криво проведённая.
               *
               * Незакрашенная доля берёт цвет пустой полоски, а не общий серый:
               * карточка затонирована цветом привычки, и серая половинка
               * смотрелась бы на ней дырой.
               */
              background:
                colors.length > 0
                  ? shareFill(colors, кто, { direction: 'to bottom', empty: 'var(--bar-empty)' })
                  : undefined,
            }}
          />
        )
      })}
    </span>
  )
}
