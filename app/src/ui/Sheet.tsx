import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Sheet.module.css'

/**
 * Модальное окно, выезжающее снизу: заголовок, полоска-грабитель сверху
 * и прокручиваемое содержимое. Используется там, где выбор слишком велик,
 * чтобы держать его прямо в форме — набор иконок, полная палитра цветов.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className={styles.grabber} />

        <header className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
