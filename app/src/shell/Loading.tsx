import { useEffect, useState } from 'react'
import type { Dict } from '../i18n'
import { Icon } from '../ui/Icon'
import styles from './Loading.module.css'

/**
 * Экран ожидания и неудачи.
 *
 * Бесплатный сервер засыпает без посетителей и просыпается до полуминуты —
 * всё это время он молчит. Пустой чёрный экран человек читает как поломку,
 * поэтому здесь всегда что-то происходит и написано, чего ждём.
 *
 * Объяснение появляется не сразу: за первую секунду обычно всё уже
 * загрузилось, и предупреждать было бы не о чем.
 */
const EXPLAIN_AFTER_MS = 1800

export function Loading({ failed, onRetry, t }: { failed: boolean; onRetry(): void; t: Dict }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (failed) return
    const id = window.setTimeout(() => setSlow(true), EXPLAIN_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [failed])

  if (failed) {
    return (
      <div className={styles.screen}>
        <span className={styles.icon}>
          <Icon name="close" size={26} />
        </span>
        <p className={styles.title}>{t.loading.failed}</p>
        <p className={styles.hint}>{t.loading.failedHint}</p>
        <button className={styles.retry} onClick={onRetry}>
          {t.loading.retry}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <span className={styles.spinner} />
      <p className={styles.title}>{t.loading.title}</p>
      {/* Место под объяснение занято всегда — иначе надпись, появившись,
          сдвигала бы всё вверху экрана. */}
      <p className={slow ? styles.hint : styles.hintHidden}>{t.loading.slow}</p>
    </div>
  )
}
