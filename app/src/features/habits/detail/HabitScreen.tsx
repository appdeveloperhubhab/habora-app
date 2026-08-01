import type { Habit } from '../../../types'
import { useStore } from '../../../store/context'
import { dict } from '../../../i18n'
import { Icon } from '../../../ui/Icon'
import { formatDuration } from '../../../lib/timer'
import { ActivityGrid } from './ActivityGrid'
import { MetricCards } from './MetricCards'
import { MonthCalendar } from './MonthCalendar'
import { TimelineChart } from './TimelineChart'
import { WeekdaysBlock } from './WeekdaysBlock'
import { YearCompare } from './YearCompare'
import styles from './HabitScreen.module.css'

/**
 * Экран привычки — вся её аналитика на одной прокручиваемой странице.
 *
 * Блоки идут от быстрого взгляда к деталям: сначала сетка активности и
 * ключевые цифры, затем календарь с точными датами, затем графики динамики.
 * Отдельного окна «Аналитика» нет намеренно: прятать графики за ещё одним
 * нажатием незачем, тап по привычке должен сразу показывать всё.
 */
export function HabitScreen({
  habit,
  onBack,
  onEdit,
  onOpenTimer,
}: {
  habit: Habit
  onBack(): void
  onEdit(): void
  onOpenTimer(): void
}) {
  const { settings, datesOf, toggleEntry } = useStore()
  const t = dict(settings.lang)
  const dates = datesOf(habit.id)

  return (
    <div className={styles.screen} style={{ '--habit': habit.color } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.iconButton} onClick={onBack} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>

        <div className={styles.heading}>
          <h2 className={styles.title}>{habit.name}</h2>
          {habit.description && <p className={styles.description}>{habit.description}</p>}
        </div>

        <button className={`${styles.iconButton} ${styles.edit}`} onClick={onEdit} aria-label={t.common.edit}>
          <Icon name="pencil" size={20} />
        </button>
      </header>

      <div className={styles.content}>
        {/* Таймер живёт здесь, а не на карточке в списке: там он мешал
            полоскам недели и был лишним для большинства привычек. */}
        {habit.durationSec !== null && (
          <button className={styles.timerButton} onClick={onOpenTimer}>
            <Icon name="play" size={18} />
            {t.timer.start}
            <span className={styles.timerDuration}>
              {formatDuration(habit.durationSec, t.timer.minutes, t.timer.seconds)}
            </span>
          </button>
        )}

        <ActivityGrid dates={dates} color={habit.color} lang={settings.lang} />
        <MetricCards habit={habit} dates={dates} lang={settings.lang} t={t} />
        <MonthCalendar
          dates={dates}
          color={habit.color}
          lang={settings.lang}
          t={t}
          onToggleDay={(date) => void toggleEntry(habit.id, date)}
        />
        <TimelineChart dates={dates} color={habit.color} lang={settings.lang} t={t} />
        <WeekdaysBlock dates={dates} color={habit.color} lang={settings.lang} t={t} />
        <YearCompare dates={dates} color={habit.color} lang={settings.lang} t={t} />
      </div>
    </div>
  )
}
