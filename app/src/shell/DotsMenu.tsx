import { useEffect } from 'react'
import { Icon, type IconName } from '../ui/Icon'
import styles from './DotsMenu.module.css'

/**
 * Меню «три точки». На этом этапе в нём ровно два пункта — «Настройки»
 * и «Порядок»; пункты «Напоминание о обзоре» и «Архив» с референса отложены.
 */

export interface MenuItem {
  id: string
  label: string
  icon: IconName
  onSelect(): void
}

interface Props {
  open: boolean
  items: MenuItem[]
  onClose(): void
}

export function DotsMenu({ open, items, onClose }: Props) {
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
      <div className={styles.menu} onClick={(e) => e.stopPropagation()} role="menu">
        {items.map((item) => (
          <button
            key={item.id}
            className={styles.item}
            role="menuitem"
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
