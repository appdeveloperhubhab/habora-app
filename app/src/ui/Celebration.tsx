import { useEffect } from 'react'
import type { Milestone } from '../lib/milestones'
import type { Dict } from '../i18n'
import { milestoneRank } from '../lib/milestones'
import { hapticSuccess } from '../lib/haptics'
import styles from './Celebration.module.css'

/**
 * Салют при достижении вехи.
 *
 * Раньше сотый день подряд ничем не отличался от второго — приложение молча
 * ставило галочку. Это единственный момент, где оно останавливается и говорит
 * человеку, что он что-то сделал.
 *
 * Частицы рисуются обычными элементами с CSS-анимацией: тащить графическую
 * библиотеку ради нескольких секунд конфетти незачем.
 */

const PARTICLE_COUNT = 28

/**
 * Поздравление для достигнутого дня.
 *
 * У памятных вех оно своё, у остальных берётся из набора по кругу — так
 * четырнадцатый день и двадцать первый не поздравляют одними и теми же
 * словами. Фраза выводится из самого числа дней, а не выбирается случайно:
 * случайная менялась бы при каждой перерисовке окна.
 */
function praiseFor(days: number, t: Dict): string {
  const special: Record<number, string> = {
    3: t.celebration.praise3,
    7: t.celebration.praise7,
    30: t.celebration.praise30,
    100: t.celebration.praise100,
    365: t.celebration.praise365,
  }

  return special[days] ?? t.celebration.praise[milestoneRank(days) % t.celebration.praise.length]
}

export function Celebration({
  milestone,
  t,
  onClose,
}: {
  milestone: Milestone
  t: Dict
  onClose(): void
}) {
  useEffect(() => {
    hapticSuccess()
    // Салют закрывается сам: держать его дольше — мешать человеку
    // продолжать отмечать привычки.
    const timer = window.setTimeout(onClose, 3200)
    return () => window.clearTimeout(timer)
  }, [onClose])

  const color = milestone.kind === 'habit' ? milestone.color : 'var(--accent)'

  const { value, title, text } =
    milestone.kind === 'first'
      ? { value: null, title: t.celebration.firstTitle, text: t.celebration.firstText }
      : milestone.kind === 'habit'
        ? {
            value: milestone.value,
            title: t.celebration.habitTitle,
            text: praiseFor(milestone.value, t),
          }
        : { value: milestone.value, title: t.celebration.appTitle, text: t.celebration.appText }

  return (
    <div className={styles.overlay} style={{ '--habit': color } as React.CSSProperties} onClick={onClose}>
      <div className={styles.particles} aria-hidden="true">
        {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
          <span
            key={i}
            className={styles.particle}
            style={
              {
                // Частицы разлетаются по кругу, каждая со своей задержкой
                // и дальностью — иначе получается ровное скучное кольцо.
                '--angle': `${(360 / PARTICLE_COUNT) * i + (i % 3) * 4}deg`,
                '--distance': `${120 + (i % 5) * 34}px`,
                '--delay': `${(i % 7) * 45}ms`,
                '--size': `${6 + (i % 3) * 3}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.card}>
        {value !== null && <span className={styles.value}>{value}</span>}
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.text}>{text}</p>
        <button className={styles.button} onClick={onClose}>
          {t.celebration.close}
        </button>
      </div>
    </div>
  )
}
