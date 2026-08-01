import styles from './EmptyState.module.css'

/** Пустой список не должен выглядеть как ошибка — только текст и подсказка, что делать. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>
    </div>
  )
}
