import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { todayIso } from '../../lib/dates'
import { hapticSelect, hapticSuccess } from '../../lib/haptics'
import { formatRemaining, isFinished, pauseTimer, progress, remainingMs, resumeTimer } from '../../lib/timer'
import { RingProgress } from '../../ui/RingProgress'
import { Icon } from '../../ui/Icon'
import styles from './TimerScreen.module.css'

/**
 * Экран запущенного таймера.
 *
 * Отсчёт не хранится в состоянии — он каждый раз пересчитывается от времени
 * старта. Тик здесь нужен только чтобы перерисовать цифры: даже если браузер
 * заморозит вкладку на десять минут, после возвращения на экране будет верное
 * время, а не то, на котором всё замерло.
 */
export function TimerScreen({ onClose }: { onClose(): void }) {
  const { settings, habits, saveSettings, toggleEntry } = useStore()
  const t = dict(settings.lang)
  const timer = settings.timer

  const [, forceTick] = useState(0)
  // Завершение должно сработать ровно один раз, даже если тик успеет
  // отработать несколько раз подряд.
  const finishing = useRef(false)

  const target = timer ? habits.find((habit) => habit.id === timer.id) : undefined

  const color = target?.color ?? settings.accentColor
  const name = target?.name ?? ''

  const finish = useCallback(async () => {
    if (!timer || finishing.current) return
    finishing.current = true

    // Отмечаем тем же способом, что и обычное нажатие: срабатывают те же
    // анимация, вибрация и проверка вех.
    await toggleEntry(timer.id, todayIso())

    hapticSuccess()
    await saveSettings({ timer: null })
    onClose()
  }, [timer, toggleEntry, saveSettings, onClose])

  /*
   * Проверка завершения живёт внутри тика, а не в отдельном эффекте.
   * Объект таймера не меняется по ходу отсчёта — он хранит только момент
   * старта, — поэтому эффект, зависящий от него, отработал бы один раз при
   * открытии экрана и больше никогда, и таймер досчитывал бы до нуля молча.
   */
  useEffect(() => {
    if (!timer || timer.pausedAt) return

    // Таймер мог доиграть, пока приложение было свёрнуто: проверяем сразу,
    // не дожидаясь первого тика.
    if (isFinished(timer)) {
      void finish()
      return
    }

    const id = window.setInterval(() => {
      if (isFinished(timer)) void finish()
      else forceTick((n) => n + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [timer, finish])

  // Таймер могли сбросить с другого экрана, а привычку — удалить.
  if (!timer || !target) {
    return null
  }

  const left = remainingMs(timer)
  const paused = timer.pausedAt !== null

  return (
    <div className={styles.screen} style={{ '--habit': color } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.close} onClick={onClose} aria-label={t.common.close}>
          <Icon name="back" size={22} />
        </button>
        <h2 className={styles.title}>{t.timer.title}</h2>
        <span />
      </header>

      <div className={styles.body}>
        <p className={styles.name}>{name}</p>

        <RingProgress value={progress(timer)} color={color} size={248} thickness={14}>
          <span className={styles.time}>{formatRemaining(left)}</span>
        </RingProgress>

        <div className={styles.actions}>
          <button
            className={styles.secondary}
            onClick={() => {
              hapticSelect()
              void saveSettings({ timer: null })
              onClose()
            }}
          >
            {t.timer.reset}
          </button>

          <button
            className={styles.primary}
            onClick={() => {
              hapticSelect()
              void saveSettings({ timer: paused ? resumeTimer(timer) : pauseTimer(timer) })
            }}
          >
            {paused ? t.timer.resume : t.timer.pause}
          </button>
        </div>
      </div>
    </div>
  )
}
