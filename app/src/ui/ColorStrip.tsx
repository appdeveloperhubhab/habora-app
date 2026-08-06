import { hapticSelect } from '../lib/haptics'
import { HABIT_COLORS } from '../theme/palette'
import styles from './ColorStrip.module.css'

/**
 * Выбор цвета: десять плиток, все на виду.
 *
 * Прокрутки вбок больше нет — она прятала половину цветов за краем экрана,
 * и выбор превращался в перебор.
 *
 * Полная палитра на полсотни оттенков открывается только там, где передан
 * `onOpenPalette`, — у акцента приложения. У привычки её нет намеренно: цвет
 * там выбирают при каждом заведении, карточек на экране несколько, и важно не
 * «какой оттенок красивее», а чтобы соседние не путались. Девять почти
 * одинаковых красных этому только мешали.
 */
export function ColorStrip({
  value,
  onChange,
  onOpenPalette,
}: {
  value: string
  onChange(color: string): void
  onOpenPalette?(): void
}) {
  /*
   * Цвет, выбранный до сокращения палитры, добавляем первой плиткой: иначе
   * у давней привычки в редакторе не было бы выделено ничего, и любое
   * прикосновение к другому полю выглядело бы как потеря её цвета.
   */
  const colors = HABIT_COLORS.includes(value) ? HABIT_COLORS : [value, ...HABIT_COLORS]

  return (
    <div className={styles.grid}>
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

      {onOpenPalette && (
        <button type="button" className={styles.palette} onClick={onOpenPalette} aria-label="Palette" />
      )}
    </div>
  )
}
