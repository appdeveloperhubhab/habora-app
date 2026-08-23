import type { Friend } from '../../types'
import { personColor } from '../../lib/personColor'

/**
 * Отметки участника совместной привычки и цвет, которым он покрашен везде:
 * во вкладке «Друзья», в цифрах на экране привычки и в клетках сеток.
 */
export interface PersonMarks {
  key: string
  color: string
  marks: Set<string>
}

/**
 * Общий пустой список: у одиночной привычки он должен быть тем же самым
 * объектом при каждой отрисовке, иначе карточка считает, что данные
 * изменились, и пересобирает сетку — в году это четыре сотни клеток.
 */
export const NO_PARTNERS: PersonMarks[] = []

/**
 * Кто ведёт эту привычку вместе с вами — с их отметками.
 *
 * Пусто у одиночной привычки и у любой, когда друзей не видно: без сервера
 * их не бывает вовсе.
 *
 * Сам человек в список не входит: его отметки лежат отдельно и меняются от
 * каждого нажатия, а этот список должен переживать отметку неизменным.
 */
export function partnersOf(habitId: string, friends: Friend[]): PersonMarks[] {
  const partners: PersonMarks[] = []

  for (const friend of friends) {
    const shared = friend.habits.find((item) => item.habitId === habitId)
    if (!shared) continue
    partners.push({
      key: String(friend.userId),
      color: personColor(friend.firstName),
      marks: new Set(shared.dates),
    })
  }

  return partners.length > 0 ? partners : NO_PARTNERS
}

/**
 * Заливка клетки: по доле на участника, в том же порядке, в каком они
 * перечислены, — сам человек первым.
 *
 * Доли режутся жёсткими границами, а не переходом: это не градиент, а две
 * краски рядом, и мягкая растушёвка между ними читалась бы как третий цвет.
 * Не отметившийся получает цвет пустого дня — так видно и что день сделан,
 * и кем именно.
 *
 * Ничего не возвращает, когда день не отметил никто: пустую клетку красит
 * обычное правило из стилей, и подменять его разметкой незачем.
 */
export function shareFill(
  colors: string[],
  кто: boolean[],
  {
    /** Куда идёт деление: по диагонали у квадратных клеток, сверху вниз у полосок. */
    direction = '135deg',
    /** Чем закрашена доля того, кто день не отметил. */
    empty = 'var(--cell-empty)',
  }: { direction?: string; empty?: string } = {},
): string | undefined {
  if (!кто.some(Boolean)) return undefined

  // Один участник — сплошная заливка, без лишней возни с долями.
  if (colors.length === 1) return colors[0]

  const доля = 100 / colors.length
  const части = colors.map((цвет, i) => `${кто[i] ? цвет : empty} ${i * доля}% ${(i + 1) * доля}%`)
  return `linear-gradient(${direction}, ${части.join(', ')})`
}
