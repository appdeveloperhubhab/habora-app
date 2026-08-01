import styles from './ConfirmDialog.module.css'

/**
 * Подтверждение необратимого действия. Удаление привычки или задачи всегда
 * проходит через этот шаг: случайный тап не должен стирать историю.
 */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  text: string
  confirmLabel: string
  cancelLabel: string
  onConfirm(): void
  onCancel(): void
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.text}>{text}</p>
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={styles.confirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
