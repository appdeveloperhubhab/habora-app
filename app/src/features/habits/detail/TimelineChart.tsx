import { useState } from 'react'
import type { Lang } from '../../../types'
import type { Dict } from '../../../i18n'
import { timeline, type TimelinePeriod } from '../../../lib/stats'
import { monthShort } from '../../../lib/dates'
import { hapticSelect } from '../../../lib/haptics'
import styles from './TimelineChart.module.css'

/**
 * Хронология: как менялось количество отметок во времени.
 *
 * График рисуем сами, обычным SVG — графическая библиотека утянула бы в сборку
 * сотню килобайт ради одной ломаной линии, а Mini App должен грузиться быстро.
 */

const PERIODS: TimelinePeriod[] = ['week', 'month', 'year']

export function TimelineChart({
  dates,
  color,
  lang,
  t,
}: {
  dates: string[]
  color: string
  lang: Lang
  t: Dict
}) {
  const [period, setPeriod] = useState<TimelinePeriod>('year')
  const monthLabels = Array.from({ length: 12 }, (_, i) => monthShort(i, lang))
  const points = timeline(dates, period, monthLabels)

  const peak = Math.max(1, ...points.map((point) => point.value))
  const width = 100
  const height = 46

  // Координаты точек в системе viewBox: слева направо, снизу вверх.
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: height - (point.value / peak) * height,
    ...point,
  }))

  const line = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const hasData = points.some((point) => point.value > 0)

  const periodLabel = (value: TimelinePeriod) =>
    value === 'week' ? t.detail.periodWeek : value === 'month' ? t.detail.periodMonth : t.detail.periodYear

  return (
    <section className={styles.card} style={{ '--habit': color } as React.CSSProperties}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>{t.detail.timeline}</h3>
          <p className={styles.hint}>{t.detail.timelineHint}</p>
        </div>

        <div className={styles.periods}>
          {PERIODS.map((value) => (
            <button
              key={value}
              className={value === period ? `${styles.period} ${styles.periodActive}` : styles.period}
              onClick={() => {
                hapticSelect()
                setPeriod(value)
              }}
            >
              {periodLabel(value)}
            </button>
          ))}
        </div>
      </header>

      {hasData ? (
        <>
          <div className={styles.chart}>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={styles.svg}>
              <polygon points={area} fill={`color-mix(in srgb, ${color} 18%, transparent)`} />
              <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <span className={styles.peak}>{peak}</span>
          </div>

          <div className={styles.labels}>
            {coords.map((point, index) => (
              <span
                key={point.date}
                className={styles.label}
                // Подписей может быть до 31 — показываем каждую пятую,
                // иначе они наезжают друг на друга.
                style={{ visibility: points.length > 12 && index % 5 !== 0 ? 'hidden' : undefined }}
              >
                {point.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.empty}>{t.detail.noData}</p>
      )}
    </section>
  )
}
