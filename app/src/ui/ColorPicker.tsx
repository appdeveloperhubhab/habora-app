import { COLOR_GROUPS } from '../theme/palette'
import type { Lang } from '../types'
import { hapticSelect } from '../lib/haptics'
import styles from './ColorPicker.module.css'

/**
 * Палитра цвета привычки: 50 оттенков, разбитых по семействам, внутри каждого —
 * несколько вариантов яркости от светлого к тёмному.
 */
export function ColorPicker({
  value,
  lang,
  onChange,
}: {
  value: string
  lang: Lang
  onChange(color: string): void
}) {
  return (
    <div className={styles.wrap}>
      {COLOR_GROUPS.map((group) => (
        <section key={group.id} className={styles.group}>
          <h4 className={styles.label}>{group.label[lang]}</h4>
          <div className={styles.swatches}>
            {group.colors.map((color) => (
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
        </section>
      ))}
    </div>
  )
}
