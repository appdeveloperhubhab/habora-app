import type { ReactNode } from 'react'
import styles from './RingProgress.module.css'

/**
 * Кольцевой индикатор с подписью внутри.
 *
 * Кольцо разомкнуто снизу: полный круг читается как «сделано целиком» даже при
 * половине заполнения, а незамкнутая дуга сразу показывает, где начало и конец.
 */
export function RingProgress({
  value,
  color,
  size = 96,
  thickness = 9,
  children,
}: {
  /** Заполнение от 0 до 1. */
  value: number
  color: string
  size?: number
  thickness?: number
  children?: ReactNode
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  // Дуга занимает 78% окружности, снизу остаётся разрыв.
  const arc = circumference * 0.78
  const filled = arc * Math.min(1, Math.max(0, value))

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(129 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className={styles.value}
          />
        </g>
      </svg>
      <div className={styles.label}>{children}</div>
    </div>
  )
}
