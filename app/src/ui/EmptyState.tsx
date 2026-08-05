import { Icon, type IconName } from './Icon'
import styles from './EmptyState.module.css'

/**
 * Пустой список не должен выглядеть как ошибка — только текст и подсказка,
 * что делать. Там, где сделать это можно прямо отсюда, подсказка дополняется
 * кнопкой: объяснять, что нужно позвать друга, и не давать способа позвать —
 * значит оставить человека ни с чем.
 */
export function EmptyState({
  title,
  hint,
  actionLabel,
  actionIcon,
  onAction,
}: {
  title: string
  hint: string
  actionLabel?: string
  actionIcon?: IconName
  onAction?(): void
}) {
  return (
    <div className={styles.wrap}>
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>

      {actionLabel && onAction && (
        <button className={styles.action} onClick={onAction}>
          {actionIcon && <Icon name={actionIcon} size={18} />}
          {actionLabel}
        </button>
      )}
    </div>
  )
}
