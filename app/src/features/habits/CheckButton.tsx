import { useState } from 'react'
import { hapticTick, hapticUntick } from '../../lib/haptics'
import styles from './CheckButton.module.css'

/**
 * Кнопка отметки — фирменный элемент приложения.
 *
 * Эффект выполнения: кнопка проминается под пальцем, изнутри разворачивается
 * светлая заливка, галочка прорисовывается штрихом, вокруг вспыхивает и гаснет
 * свечение. Одновременно по неделе слева направо пробегает волна из полосок
 * (её запускает карточка) — вместе это читается как одно движение.
 *
 * У привычки с нормой на день кнопка становится счётчиком: по краю идут доли
 * по числу нужных выполнений, внутри — сколько уже сделано. Заливка и галочка
 * приходят только с последней долей: праздновать неполный день не за что.
 */

interface Props {
  done: boolean
  color: string
  /** Сколько раз выполнено сегодня и сколько нужно. Норма в один раз — обычная галочка. */
  count?: number
  target?: number
  /** Диаметр кнопки; крупный вариант используется в режиме «месяц». */
  size?: number
  disabled?: boolean
  /** Подсказка новичку: кнопка мягко пульсирует, пока её не нажали впервые. */
  hint?: boolean
  onToggle(): void
}

/** Радиус кольца долей в системе координат картинки 100×100. */
const RING_RADIUS = 46
const RING_WIDTH = 7
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function CheckButton({
  done,
  color,
  count = 0,
  target = 1,
  size = 44,
  disabled = false,
  hint = false,
  onToggle,
}: Props) {
  // Ключ перезапускает анимацию свечения: без смены ключа повторное нажатие
  // подряд не проигрывало бы её заново.
  const [glowKey, setGlowKey] = useState(0)

  const counted = target > 1

  const handleClick = () => {
    if (disabled) return
    if (done) hapticUntick()
    else hapticTick()
    // Свечение только когда день закрылся: заливка и галочка при снятии уходят
    // сами — это смена состояния, а вспышка вокруг кнопки была бы похвалой.
    // У привычки с нормой она приходит на последнюю долю, а не на каждую.
    if (!done) setGlowKey((k) => k + 1)
    onToggle()
  }

  /*
   * Доли рисуются отдельными дугами, а не одной пунктирной линией: пунктир
   * повторяется по всей окружности, и показать им «закрашены первые две из
   * трёх» нельзя — только «закрашено везде понемногу».
   */
  const step = CIRCUMFERENCE / Math.max(1, target)
  const gap = Math.min(step * 0.22, 10)

  return (
    <button
      className={[styles.button, done ? styles.done : '', hint ? styles.hint : ''].filter(Boolean).join(' ')}
      /* Размер шрифта равен диаметру: цифра внутри задана в его долях и
         сама подстраивается под крупную кнопку в режиме «месяц». */
      style={{ '--habit': color, width: size, height: size, fontSize: size } as React.CSSProperties}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={done}
      aria-label="Toggle"
    >
      {glowKey > 0 && <span key={glowKey} className={styles.glow} />}
      <span className={styles.fill} />

      {counted && (
        <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
          {Array.from({ length: target }, (_, i) => (
            <circle
              key={i}
              className={i < count ? styles.segmentDone : styles.segment}
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_WIDTH}
              strokeLinecap="round"
              strokeDasharray={`${step - gap} ${CIRCUMFERENCE - step + gap}`}
              // Первая доля начинается сверху, дальше по часовой стрелке.
              strokeDashoffset={-i * step}
              transform="rotate(-90 50 50)"
            />
          ))}
        </svg>
      )}

      {counted && !done ? (
        <span className={styles.count}>{count}</span>
      ) : (
        <svg className={styles.tick} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5.5 12.5 10 17 18.5 7.5"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
