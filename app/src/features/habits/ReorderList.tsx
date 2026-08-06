import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { hapticSelect } from '../../lib/haptics'
import styles from './ReorderList.module.css'

/**
 * Список с перетаскиванием карточек.
 *
 * Место, куда встанет карточка, ищется по настоящим координатам соседей,
 * снятым в момент начала перетаскивания, а не по номеру в списке. Так одна и
 * та же разметка работает и для колонки недели, и для плитки месяца в два
 * столбца: в колонке ближайший сосед всегда сверху или снизу, в плитке —
 * ещё и сбоку, и отдельного кода под каждый случай не нужно.
 *
 * Перетаскивание начинается сразу по касанию, без долгого нажатия: включается
 * оно только в режиме «Порядок», где карточки всё равно не нажимаются, и
 * заставлять там удерживать палец значило бы прятать единственное доступное
 * действие.
 */

interface Props {
  /** Порядок сверху вниз; он же порядок отрисовки. */
  ids: string[]
  /** Перетаскивание доступно только в режиме «Порядок». */
  enabled: boolean
  className?: string
  onReorder(ids: string[]): void
  renderItem(id: string): ReactNode
}

/** Тот же массив, но элемент переехал с места `from` на место `to`. */
function move<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export function ReorderList({ ids, enabled, className, onReorder, renderItem }: Props) {
  const host = useRef<HTMLDivElement>(null)
  /** Координаты всех карточек на момент начала перетаскивания. */
  const slots = useRef<DOMRect[]>([])
  const origin = useRef({ x: 0, y: 0 })

  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })

  const begin = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    const nodes = [...(host.current?.children ?? [])] as HTMLElement[]
    slots.current = nodes.map((node) => node.getBoundingClientRect())
    origin.current = { x: event.clientX, y: event.clientY }
    setFrom(index)
    setTo(index)
    setShift({ x: 0, y: 0 })
    hapticSelect()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (from === null) return

    const dx = event.clientX - origin.current.x
    const dy = event.clientY - origin.current.y
    setShift({ x: dx, y: dy })

    // Куда карточка встанет, если отпустить сейчас: ближайшее по центру место.
    const dragged = slots.current[from]
    const x = dragged.left + dragged.width / 2 + dx
    const y = dragged.top + dragged.height / 2 + dy

    let nearest = from
    let best = Infinity
    slots.current.forEach((slot, index) => {
      const distance = Math.hypot(slot.left + slot.width / 2 - x, slot.top + slot.height / 2 - y)
      if (distance < best) {
        best = distance
        nearest = index
      }
    })

    if (nearest !== to) {
      // Отклик в момент смены места, а не в конце: так понятно, что карточка
      // уже перескочила, ещё до того как палец убран.
      hapticSelect()
      setTo(nearest)
    }
  }

  const end = () => {
    if (from !== null && to !== null && to !== from) onReorder(move(ids, from, to))
    setFrom(null)
    setTo(null)
    setShift({ x: 0, y: 0 })
  }

  /**
   * Куда сдвинуть карточку, которую не тащат.
   *
   * Она переезжает ровно на соседнее место — из координат соседа и берётся
   * сдвиг. Считать его по высоте карточки нельзя: в плитке соседнее место
   * бывает сбоку, а карточки в паре разной высоты.
   */
  const shiftOf = (index: number): string | undefined => {
    if (from === null || to === null || index === from) return undefined

    let target = index
    if (from < to && index > from && index <= to) target = index - 1
    else if (from > to && index >= to && index < from) target = index + 1
    if (target === index) return undefined

    const now = slots.current[index]
    const next = slots.current[target]
    return `translate(${next.left - now.left}px, ${next.top - now.top}px)`
  }

  return (
    <div className={className} ref={host}>
      {ids.map((id, index) => (
        <div
          key={id}
          className={[
            styles.item,
            enabled ? styles.draggable : '',
            index === from ? styles.dragging : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            transform:
              index === from ? `translate(${shift.x}px, ${shift.y}px)` : shiftOf(index),
          }}
          onPointerDown={begin(index)}
          onPointerMove={drag}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {renderItem(id)}
        </div>
      ))}
    </div>
  )
}
