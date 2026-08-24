import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
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

/*
 * Сколько длится каскад появления списка целиком: собственная длительность
 * плюс задержка самой последней карточки (`--t-list` и семь шагов
 * `--t-stagger`), с небольшим запасом.
 */
const CASCADE_MS = 1100

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

  /** Где карточки стояли на прошлой отрисовке — по ним считается переезд. */
  const places = useRef(new Map<string, { left: number; top: number }>())

  /*
   * Отыграл ли каскад появления.
   *
   * Задержки каскада заданы через `nth-child`, то есть привязаны к месту в
   * списке, а не к самой карточке. Стоит порядку измениться — у карточки
   * меняется задержка, браузер считает это новой анимацией и проигрывает
   * появление заново. Выглядело это так: выполненная привычка не уезжала
   * вниз, а мигала на новом месте, — да ещё и перебивала собой переезд,
   * потому что анимация в CSS сильнее перехода.
   *
   * Поэтому каскад живёт ровно столько, сколько длится сам: появились —
   * и хватит. Дальше карточки только переезжают.
   */
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), CASCADE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  /*
   * Переезд карточек на новые места.
   *
   * Порядок в списке меняется мгновенно — React просто переставляет узлы, и
   * карточка оказывается внизу без всякого движения. Чтобы переезд было
   * видно, каждую сдвинувшуюся карточку сначала возвращаем сдвигом туда, где
   * она была, а следующим кадром отпускаем: браузер доводит её до нового
   * места сам, уже с переходом.
   *
   * Замер идёт по `offsetTop`, а не по положению на экране: прокрутка списка
   * меняет второе, не трогая первое, и по нему карточки «переезжали» бы от
   * каждого движения пальца по экрану.
   */
  useLayoutEffect(() => {
    const nodes = [...(host.current?.children ?? [])] as HTMLElement[]

    const now = new Map<string, { left: number; top: number }>()
    const moved: { node: HTMLElement; dx: number; dy: number }[] = []

    nodes.forEach((node, index) => {
      const id = ids[index]
      const place = { left: node.offsetLeft, top: node.offsetTop }
      now.set(id, place)

      const before = places.current.get(id)
      if (!before) return

      const dx = before.left - place.left
      const dy = before.top - place.top
      // Порог в пиксель: дробные доли появляются от округления ширины колонок
      // и переездом не являются.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      moved.push({ node, dx, dy })
    })

    places.current = now

    // Пока карточку тащат, местами распоряжается перетаскивание — со своими
    // сдвигами и своей отменённой анимацией.
    if (from !== null || moved.length === 0) return

    for (const { node, dx, dy } of moved) {
      node.style.transition = 'none'
      node.style.transform = `translate(${dx}px, ${dy}px)`
    }

    // Заставляем браузер принять исходное положение прямо сейчас: иначе он
    // сложит оба изменения в одно и никакого движения не покажет.
    void host.current?.offsetHeight

    for (const { node } of moved) {
      node.classList.add(styles.reflow)
      node.style.transition = ''
      node.style.transform = ''

      /*
       * Снимаем метку переезда, когда доехали. Проверка отправителя
       * обязательна: события переходов всплывают, и любой из переходов внутри
       * карточки — заливка кнопки, цвет клетки — иначе оборвал бы переезд на
       * полпути, а вместе с ним и само движение.
       */
      const done = (event: TransitionEvent) => {
        if (event.target !== node) return
        node.classList.remove(styles.reflow)
        node.removeEventListener('transitionend', done)
      }
      node.addEventListener('transitionend', done)
    }
  }, [ids, from])

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
    <div className={settled ? `${className ?? ''} ${styles.settled}` : className} ref={host}>
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
