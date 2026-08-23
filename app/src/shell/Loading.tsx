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

export function Loading({
  failed,
  denied = false,
  onRetry,
  t,
}: {
  failed: boolean
  /** Доступ закрыт владельцем бота — не поломка, повторять нечего. */
  denied?: boolean
  onRetry(): void
  t: Dict
}) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (failed) return
    const id = window.setTimeout(() => setSlow(true), EXPLAIN_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [failed])

  /*
   * Закрытый доступ. Тот же экран, что и у неудачи, но без кнопки «Повторить»:
   * от повтора здесь ничего не изменится, и предлагать его — значит отправить
   * человека жать её до бесконечности.
   */
  if (denied) {
    return (
      <div className={styles.screen}>
        <span className={styles.icon}>
          <Icon name="close" size={26} />
        </span>
        <p className={styles.title}>{t.loading.denied}</p>
        <p className={styles.hint}>{t.loading.deniedHint}</p>
      </div>
    )
  }

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
