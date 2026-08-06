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
 * там выбирают при каждом её заведении, карточек на экране несколько, и важно
 * не «какой оттенок красивее», а чтобы соседние не путались.
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
   * Ряд всегда ровно из десяти плиток. Показать одиннадцатой чужой цвет —
   * значит сломать сетку пять на пять ради редкого случая; вместо этого
   * привычке со старым оттенком его подменяет ближайший из набора, и делает
   * это редактор, а не этот компонент (см. `nearestHabitColor`).
   *
   * У акцента приложения свой цвет законен: там есть полная палитра, и
   * выбранное в ней должно оставаться видимым.
   */
  const extra = onOpenPalette && !HABIT_COLORS.some((color) => color.value === value)

  return (
    <div className={styles.grid}>
      {extra && (
        <button
          type="button"
          className={`${styles.swatch} ${styles.selected}`}
          style={{ '--from': value, '--to': value, '--swatch': value } as React.CSSProperties}
          onClick={() => hapticSelect()}
          aria-label={value}
          aria-pressed
        />
      )}

      {HABIT_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={color.value === value ? `${styles.swatch} ${styles.selected}` : styles.swatch}
          style={
            {
              '--from': color.from,
              '--to': color.to,
              '--swatch': color.value,
            } as React.CSSProperties
          }
          onClick={() => {
            hapticSelect()
            onChange(color.value)
          }}
          aria-label={color.value}
          aria-pressed={color.value === value}
        />
      ))}

      {onOpenPalette && (
        <button type="button" className={styles.palette} onClick={onOpenPalette} aria-label="Palette" />
      )}
    </div>
  )
}
