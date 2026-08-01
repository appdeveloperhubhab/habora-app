import { Icon } from '../ui/Icon'
import styles from './Placeholder.module.css'

/**
 * Временный экран для разделов, до которых ещё не дошли по плану.
 * Нужен, чтобы навигация и кнопка «назад» проверялись уже сейчас,
 * а не после того, как все экраны будут готовы.
 */
export function Placeholder({ title, note, onBack }: { title: string; note: string; onBack(): void }) {
  return (
    <div className={styles.screen}>
      <header className={styles.bar}>
        <button className={styles.back} onClick={onBack} aria-label="Back">
          <Icon name="back" size={22} />
        </button>
        <h2 className={styles.title}>{title}</h2>
        <span />
      </header>
      <p className={styles.note}>{note}</p>
    </div>
  )
}
