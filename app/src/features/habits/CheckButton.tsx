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
 */

interface Props {
  done: boolean
  color: string
  /** Диаметр кнопки; крупный вариант используется в режиме «месяц». */
  size?: number
  disabled?: boolean
  /** Подсказка новичку: кнопка мягко пульсирует, пока её не нажали впервые. */
  hint?: boolean
  onToggle(): void
}

export function CheckButton({ done, color, size = 44, disabled = false, hint = false, onToggle }: Props) {
  // Ключ перезапускает анимацию свечения: без смены ключа повторное нажатие
  // подряд не проигрывало бы её заново.
  const [glowKey, setGlowKey] = useState(0)

  const handleClick = () => {
    if (disabled) return
    if (done) hapticUntick()
    else hapticTick()
    // Свечение только при простановке: заливка и галочка при снятии уходят
    // сами — это смена состояния, а вспышка вокруг кнопки была бы похвалой.
    if (!done) setGlowKey((k) => k + 1)
    onToggle()
  }

  return (
    <button
      className={[styles.button, done ? styles.done : '', hint ? styles.hint : ''].filter(Boolean).join(' ')}
      style={{ '--habit': color, width: size, height: size } as React.CSSProperties}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={done}
      aria-label="Toggle"
    >
      {glowKey > 0 && <span key={glowKey} className={styles.glow} />}
      <span className={styles.fill} />

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
    </button>
  )
}
