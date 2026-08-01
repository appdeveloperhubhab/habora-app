import { useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import styles from './TopBar.module.css'

/**
 * Верхняя панель главного экрана: три точки и поиск слева, название текущей
 * вкладки с сегодняшней датой по центру, «+» справа. Название приложения здесь
 * намеренно не показывается — по центру всегда видно, в каком разделе находишься.
 *
 * Поиск нарочно тише остальных кнопок: он нужен изредка. «+» наоборот выделен
 * акцентным цветом — это главное действие экрана.
 *
 * В режиме поиска панель перестраивается: вместо заголовка поле ввода,
 * вместо «три точки» — кнопка выхода из поиска.
 */

interface Props {
  title: string
  date: string
  onMenu(): void
  onAdd(): void
  /** В режиме «Порядок» кнопка «+» временно заменяется на «Готово». */
  orderMode?: boolean
  doneLabel?: string
  onDone?(): void

  searching: boolean
  query: string
  searchPlaceholder: string
  onSearchOpen(): void
  onSearchClose(): void
  onQueryChange(value: string): void
}

export function TopBar({
  title,
  date,
  onMenu,
  onAdd,
  orderMode = false,
  doneLabel,
  onDone,
  searching,
  query,
  searchPlaceholder,
  onSearchOpen,
  onSearchClose,
  onQueryChange,
}: Props) {
  const input = useRef<HTMLInputElement>(null)

  // Клавиатура должна появляться сразу — иначе после тапа по лупе нужен
  // второй тап по полю.
  useEffect(() => {
    if (searching) input.current?.focus()
  }, [searching])

  if (searching) {
    return (
      <header className={styles.searchBar}>
        <button className={styles.iconButton} onClick={onSearchClose} aria-label="Close search">
          <Icon name="back" size={22} />
        </button>

        <input
          ref={input}
          className={styles.searchInput}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          type="search"
        />

        {query !== '' && (
          <button className={styles.iconButton} onClick={() => onQueryChange('')} aria-label="Clear">
            <Icon name="close" size={20} />
          </button>
        )}
      </header>
    )
  }

  return (
    <header className={styles.bar}>
      <div className={styles.side}>
        <button className={styles.iconButton} onClick={onMenu} aria-label="Menu">
          <Icon name="dots" size={22} />
        </button>
        <button className={styles.quietButton} onClick={onSearchOpen} aria-label="Search">
          <Icon name="search" size={19} strokeWidth={1.7} />
        </button>
      </div>

      <div className={styles.center}>
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.date}>{date}</span>
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
