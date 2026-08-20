import { useEffect, useRef, type ReactNode } from 'react'
import { hapticSelect } from '../lib/haptics'
import styles from './SwipeBack.module.css'

/**
 * Возврат жестом от левого края экрана.
 *
 * Стрелка «назад» стоит в углу шапки, и дотянуться до неё большим пальцем на
 * большом телефоне — отдельное усилие: экран приходится перехватывать. Жест
 * доступен той же рукой, которой держат телефон, и это привычное движение —
 * так закрываются экраны и в iOS, и в Android.
 *
 * Экран едет за пальцем, а не просто исчезает по факту жеста: пока палец на
 * стекле, видно, куда всё движется и что произойдёт, если отпустить, — и
 * передумать можно, вернув палец обратно.
 *
 * Обычный `touch-action: pan-y` в CSS решил бы задачу перехвата в одну строку,
 * но он запрещает горизонтальные жесты всему, что лежит внутри, а отменить
 * этот запрет вложенным элементам нельзя. Внутри экранов есть полосы с
 * горизонтальной прокруткой — сетка активности, хронология, — и они бы
 * перестали прокручиваться. Поэтому решение принимается вручную по первым
 * миллиметрам движения.
 */

/** Ширина полосы у края, с которой начинается жест. */
const EDGE_PX = 28

/** Сдвиг, после которого решаем: это возврат, а не прокрутка. */
const DECIDE_PX = 8

/** Доля ширины экрана: дальше отпускание засчитывается как возврат. */
const COMMIT_RATIO = 0.3

/** Скорость броска в пикселях за миллисекунду — засчитывается и без порога. */
const FLING_SPEED = 0.5

/** Длительность доводки после отпускания. */
const SETTLE_MS = 190

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  /** Решение принято: это возврат, экран едет за пальцем. */
  active: boolean
  lastX: number
  lastAt: number
  /** Скорость последнего движения, пикселей за миллисекунду. */
  speed: number
}

export function SwipeBack({
  onBack,
  screenKey,
  children,
}: {
  onBack(): void
  /** Какой экран сейчас наверху — по его смене слой возвращается в исходное. */
  screenKey: string
  children: ReactNode
}) {
  const layer = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  /*
   * Обработчик возврата держим в ссылке: он меняется при каждой отрисовке
   * родителя, а переподписывать из-за этого слушатели касаний — значит терять
   * начатый жест на середине.
   */
  const backRef = useRef(onBack)
  backRef.current = onBack

  /*
   * Смена экрана возвращает слой в исходное положение.
   *
   * Слой переживает возврат, если под снятым экраном лежит ещё один: тогда на
   * нём остаётся сдвиг от доведённого жеста, и следующий экран оказывается
   * уехавшим за правый край и прозрачным — то есть исчезает целиком.
   *
   * Сброс живёт именно в эффекте, а не сразу после возврата: к этому моменту
   * React уже показал новый экран, и снятый не успевает мигнуть на месте.
   * Заодно чинится случай, когда экран сменили не жестом, а стрелкой или
   * системной кнопкой прямо посреди жеста.
   */
  useEffect(() => {
    const el = layer.current
    if (!el) return

    gesture.current = null
    el.style.transition = ''
    el.style.transform = ''
    el.style.opacity = ''
  }, [screenKey])

  useEffect(() => {
    const el = layer.current
    if (!el) return

    /** Ведём экран за пальцем: сдвиг вправо и лёгкое угасание. */
    const paint = (shift: number) => {
      el.style.transform = shift === 0 ? '' : `translateX(${shift}px)`
      el.style.opacity = shift === 0 ? '' : String(1 - Math.min(shift / el.offsetWidth, 1) * 0.4)
    }

    /** Плавно доводим до конца или возвращаем на место. */
    const settle = (done: boolean) => {
      el.style.transition = `transform ${SETTLE_MS}ms var(--ease-screen), opacity ${SETTLE_MS}ms linear`

      if (done) {
        hapticSelect()
        el.style.transform = 'translateX(100%)'
        el.style.opacity = '0'
        // Экран снимаем чуть раньше конца доводки: за оставшиеся миллисекунды
        // глаз не успевает заметить стык, а пауза на пустом месте — заметна.
        window.setTimeout(() => backRef.current(), SETTLE_MS - 20)
        return
      }

      paint(0)
      window.setTimeout(() => {
        el.style.transition = ''
      }, SETTLE_MS)
    }

    const onDown = (e: PointerEvent) => {
      // Только основная кнопка мыши и только от самого края.
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.clientX > EDGE_PX) return

      gesture.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        lastX: e.clientX,
        lastAt: e.timeStamp,
        speed: 0,
      }
    }

    const onMove = (e: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return

      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY

      if (!g.active) {
        // Палец пошёл вверх или вниз — это прокрутка, жест не наш.
        if (Math.abs(dy) > Math.abs(dx)) {
          gesture.current = null
          return
        }
        if (dx < DECIDE_PX) return

        g.active = true
        el.style.transition = 'none'

        /*
         * Захват удерживает события на слое, даже если палец уйдёт за его
         * пределы. Не обязателен: без него жест доработает по обычным
         * событиям. Зато отказать он может — палец успевают отпустить между
         * тем, как событие поставлено в очередь, и тем, как мы его читаем, —
         * и несработавший захват не должен обрывать сам жест.
         */
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          // Указателя уже нет — ведём экран по обычным событиям.
        }
      }

      const dt = e.timeStamp - g.lastAt
      if (dt > 0) g.speed = (e.clientX - g.lastX) / dt
      g.lastX = e.clientX
      g.lastAt = e.timeStamp

      // Влево экран не уезжает: за левым краем ничего нет, и резина там
      // обещала бы движение, которого не будет.
      paint(Math.max(0, dx))
    }

    const onUp = (e: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return
      gesture.current = null
      if (!g.active) return

      const dx = Math.max(0, e.clientX - g.startX)
      // Быстрый бросок засчитывается и на половине пути: намерение по нему
      // читается не хуже, чем по пройденному расстоянию.
      settle(dx > el.offsetWidth * COMMIT_RATIO || g.speed > FLING_SPEED)
    }

    const onCancel = () => {
      const g = gesture.current
      gesture.current = null
      if (g?.active) settle(false)
    }

    /*
     * Прокрутку останавливаем именно здесь: `preventDefault` на событиях
     * указателя браузер игнорирует, а на касании — слушает, но только если
     * подписаться с `passive: false`. React подписывается иначе, поэтому
     * слушатель заводится вручную.
     */
    const onTouchMove = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return (
    <div ref={layer} className={styles.layer}>
      {children}
    </div>
  )
}
