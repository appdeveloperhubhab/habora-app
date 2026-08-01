import { useEffect } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './ActionSheet.module.css'

/**
 * Меню действий, выезжающее снизу. Пункты крупные и близко к большому пальцу —
 * на телефоне это удобнее выпадающего списка у верхнего края экрана.
 */

export interface SheetAction {
  id: string
  label: string
  icon: IconName
  /** Опасные действия (удаление) выделяются цветом и всегда идут последними. */
  danger?: boolean
  onSelect(): void
}

interface Props {
  open: boolean
  title?: string
  actions: SheetAction[]
  cancelLabel: string
  onClose(): void
}

export function ActionSheet({ open, title, actions, cancelLabel, onClose }: Props) {
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
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="menu">
        <span className={styles.grabber} />
        {title && <p className={styles.title}>{title}</p>}

        {actions.map((action) => (
          <button
            key={action.id}
            role="menuitem"
            className={action.danger ? `${styles.action} ${styles.danger}` : styles.action}
            onClick={() => {
              onClose()
              action.onSelect()
            }}
          >
            <Icon name={action.icon} size={20} />
            <span>{action.label}</span>
          </button>
        ))}

        <button className={styles.cancel} onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </div>
  )
}
