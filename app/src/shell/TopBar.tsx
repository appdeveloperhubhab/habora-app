import { Icon } from '../ui/Icon'
import styles from './TopBar.module.css'

/**
 * Верхняя панель главного экрана: настройки и порядок слева, название текущей
 * вкладки по центру, «+» справа. Название приложения здесь намеренно не
 * показывается — по центру всегда видно, в каком разделе находишься.
 *
 * Сегодняшней даты под названием больше нет. Она ничего не решала: приложение
 * открывают, чтобы отметить сегодняшний день, и какое сегодня число, человек
 * и так знает — а место занимала и заставляла название быть мелким, чтобы
 * они вдвоём поместились в высоту панели.
 *
 * Обе левые кнопки открыты, а не спрятаны за «три точки»: их всего две, и
 * лишний тап по меню ради выбора из двух пунктов ничего не экономил.
 *
 * «+» выделен акцентным цветом — это главное действие экрана.
 */

interface Props {
  title: string
  settingsLabel: string
  orderLabel: string
  onSettings(): void
  onOrder(): void
  onAdd(): void
  /** В режиме «Порядок» кнопка «+» временно заменяется на «Готово». */
  orderMode?: boolean
  doneLabel?: string
  onDone?(): void
}

export function TopBar({
  title,
  settingsLabel,
  orderLabel,
  onSettings,
  onOrder,
  onAdd,
  orderMode = false,
  doneLabel,
  onDone,
}: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.side}>
        <button className={styles.iconButton} onClick={onSettings} aria-label={settingsLabel}>
          <Icon name="settings" size={21} />
        </button>
        <button className={styles.iconButton} onClick={onOrder} aria-label={orderLabel}>
          <Icon name="viewWeek" size={21} />
        </button>
      </div>

      <div className={styles.center}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={`${styles.side} ${styles.sideEnd}`}>
        {orderMode ? (
          <button className={styles.doneButton} onClick={onDone}>
            {doneLabel}
          </button>
        ) : (
          <button className={styles.addButton} onClick={onAdd} aria-label="Add">
            <Icon name="plus" size={24} strokeWidth={2.1} />
          </button>
        )}
      </div>
    </header>
  )
}
