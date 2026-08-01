import { hapticSelect } from '../lib/haptics'
import styles from './ColorStrip.module.css'

/**
 * Компактный выбор цвета: одна строка кружков с прокруткой вбок.
 *
 * Полная палитра из 50 оттенков занимала пол-экрана, поэтому здесь показаны
 * только ходовые цвета, а весь набор открывается радужным кружком слева —
 * он всегда первый в ряду и не уезжает при прокрутке.
 */

/**
 * Быстрый ряд: по четыре оттенка из каждой группы палитры, от ярких к тёмным.
 * Их заметно больше, чем помещается на экран, — ряд прокручивается вбок,
 * а весь набор из полусотни цветов открывается радужным кружком.
 */
const QUICK_COLORS = [
  '#FF3B30', '#FF6FA5', '#FF6B5A', '#C2185B',
  '#FF9500', '#FFD60A', '#FFB300', '#B7791F',
  '#34C759', '#A3E635', '#10B981', '#1B7F4C',
  '#38BDF8', '#06B6D4', '#007AFF', '#1D4ED8',
  '#A78BFA', '#8B5CF6', '#9333EA', '#6D28D9',
  '#C9B79C', '#8E8E99', '#6B4F3A', '#4B4B55',
]

export function ColorStrip({
  value,
  onChange,
  onOpenPalette,
}: {
  value: string
  onChange(color: string): void
  onOpenPalette(): void
}) {
  // Выбранный из полной палитры цвет добавляем в ряд, иначе он нигде
  // не отображался бы как активный.
  const colors = QUICK_COLORS.includes(value) ? QUICK_COLORS : [value, ...QUICK_COLORS]

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.palette} onClick={onOpenPalette} aria-label="Palette">
        <span className={styles.rainbow} />
      </button>

      <span className={styles.divider} />

      <div className={styles.strip}>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={color === value ? `${styles.swatch} ${styles.selected}` : styles.swatch}
            style={{ '--swatch': color } as React.CSSProperties}
            onClick={() => {
              hapticSelect()
              onChange(color)
            }}
            aria-label={color}
            aria-pressed={color === value}
          />
        ))}
      </div>
    </div>
  )
}
