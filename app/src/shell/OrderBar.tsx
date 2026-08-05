import type { CardView } from '../types'
import { hapticSelect } from '../lib/haptics'
import { Icon, type IconName } from '../ui/Icon'
import styles from './OrderBar.module.css'

/**
 * Плавающая капсула режима «Порядок»: три вида карточек.
 *
 * Выхода отсюда нет — из режима выводит «Готово» в шапке. Крестик рядом с
 * капсулой делал то же самое, и две кнопки на одно действие заставляли
 * выбирать там, где выбора нет.
 *
 * Выбор применяется сразу ко всем привычкам, а не по одной — иначе список
 * превратился бы в лоскутное одеяло из разных карточек.
 *
 * Порядок слева направо — от самого компактного вида к самому крупному:
 * строка, плитка, месяц. Так переключатель читается как шкала размера.
 */
const VIEWS: { id: CardView; icon: IconName }[] = [
  { id: 'week', icon: 'viewCompact' },
  { id: 'month', icon: 'viewMonth' },
  { id: 'year', icon: 'viewTable' },
]

export function OrderBar({
  value,
  labels,
  onChange,
}: {
  value: CardView
  labels: Record<CardView, string>
  onChange(view: CardView): void
}) {
  const activeIndex = Math.max(0, VIEWS.findIndex((view) => view.id === value))

  return (
    <div className={styles.wrap}>
      <div className={styles.capsule} role="radiogroup">
        {/* Подсветка не перекрашивается скачком, а переезжает к выбранной
            иконке — движение читается как отклик на нажатие. */}
        <span
          className={styles.thumb}
          // Шаг — ширина кнопки плюс зазор между ними, иначе подсветка
          // с каждой позицией всё сильнее отстаёт от иконки.
          style={{ transform: `translateX(calc(${activeIndex} * (100% + var(--sp-1))))` }}
        />

        {VIEWS.map((view, index) => (
          <button
            key={view.id}
            role="radio"
            aria-checked={view.id === value}
            aria-label={labels[view.id]}
            className={view.id === value ? `${styles.item} ${styles.active}` : styles.item}
            // Иконки проявляются одна за другой, тем же шагом, что карточки
            // в списке, — движение по всему приложению идёт в одном темпе.
            style={{ animationDelay: `calc(var(--t-stagger) * ${index + 1})` }}
            onClick={() => {
              hapticSelect()
              onChange(view.id)
            }}
          >
            <Icon name={view.icon} size={25} />
          </button>
        ))}
      </div>
    </div>
  )
}
