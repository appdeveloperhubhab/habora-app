import { useState } from 'react'
import type { Habit, HabitInput, ScheduleType, Weekday } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { weekdayShort } from '../../lib/dates'
import { hapticSelect, hapticSuccess, hapticWarning } from '../../lib/haptics'
import { nextDefaultColor } from '../../theme/palette'
import { DEFAULT_HABIT_ICON } from '../../ui/habitIconSet'
import { HabitIcon } from '../../ui/habitIcons'
import { ColorPicker } from '../../ui/ColorPicker'
import { ColorStrip } from '../../ui/ColorStrip'
import { IconPicker } from '../../ui/IconPicker'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { DurationPicker } from '../../ui/DurationPicker'
import { Toggle } from '../../ui/Toggle'
import { Icon } from '../../ui/Icon'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { ActivityGrid } from './detail/ActivityGrid'
import styles from './HabitEditor.module.css'

/**
 * Создание и редактирование привычки — одно место для всех её параметров.
 *
 * Форма намеренно короткая: набор иконок и полная палитра вынесены в отдельные
 * окна, иначе они занимали несколько экранов прокрутки и всё остальное
 * терялось под ними.
 */

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export function HabitEditor({ habit, onClose }: { habit: Habit | null; onClose(): void }) {
  const { habits, settings, datesOf, createHabit, updateHabit, deleteHabit } = useStore()
  const t = dict(settings.lang)

  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [icon, setIcon] = useState(habit?.icon ?? DEFAULT_HABIT_ICON)
  const [color, setColor] = useState(habit?.color ?? nextDefaultColor(habits.length))
  const [tinted, setTinted] = useState(habit?.tinted ?? true)
  const [scheduleType, setScheduleType] = useState<ScheduleType>(habit?.schedule.type ?? 'weekdays')
  const [days, setDays] = useState<Weekday[]>(habit?.schedule.days ?? ALL_WEEKDAYS)
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.schedule.timesPerWeek ?? 3)
  const [streakGoal, setStreakGoal] = useState<number | null>(habit?.streakGoal ?? null)
  const [durationSec, setDurationSec] = useState<number | null>(habit?.durationSec ?? null)

  const [error, setError] = useState<string | null>(null)
  const [iconSheet, setIconSheet] = useState(false)
  const [colorSheet, setColorSheet] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggleDay = (day: Weekday) => {
    hapticSelect()
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      hapticWarning()
      setError(t.editor.nameRequired)
      return
    }
    if (scheduleType === 'weekdays' && days.length === 0) {
      hapticWarning()
      setError(t.editor.daysRequired)
      return
    }

    const input: HabitInput = {
      name: trimmed,
      description: description.trim(),
      icon,
      color,
      tinted,
      schedule: { type: scheduleType, days, timesPerWeek },
      streakGoal,
      durationSec,
    }

    if (habit) await updateHabit(habit.id, input)
    else await createHabit(input)

    hapticSuccess()
    onClose()
  }

  const handleDelete = async () => {
    if (!habit) return
    await deleteHabit(habit.id)
    onClose()
  }

  return (
    <div className={styles.screen} style={{ '--habit': color } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.close} onClick={onClose} aria-label={t.common.cancel}>
          <Icon name="close" size={20} />
        </button>
        <h2 className={styles.title}>{habit ? t.editor.editTitle : t.editor.newTitle}</h2>
        <button className={styles.save} onClick={handleSave} aria-label={t.common.save}>
          <Icon name="check" size={22} />
        </button>
      </header>

      <div className={styles.content}>
        {/* Превью перекрашивается сразу при выборе цвета, до сохранения. */}
        <ActivityGrid dates={habit ? datesOf(habit.id) : []} color={color} lang={settings.lang} />

        <div className={styles.nameRow}>
          <button className={styles.iconButton} onClick={() => setIconSheet(true)} aria-label={t.editor.icon}>
            <HabitIcon icon={icon} size={24} />
          </button>

          <input
            className={styles.nameInput}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder={t.editor.namePlaceholder}
            maxLength={60}
            autoFocus={!habit}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.colorBlock}>
          <ColorStrip value={color} onChange={setColor} onOpenPalette={() => setColorSheet(true)} />

          <div className={styles.tintRow}>
            <span className={styles.tintText}>
              <span className={styles.tintTitle}>{t.editor.tinted}</span>
              <span className={styles.tintHint}>{t.editor.tintedHint}</span>
            </span>
            <Toggle checked={tinted} color={color} onChange={setTinted} label={t.editor.tinted} />
          </div>
        </div>

        <input
          className={styles.input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.editor.descriptionPlaceholder}
          maxLength={120}
        />

        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.schedule}</h3>

          <div className={styles.segment}>
            <button
              className={scheduleType === 'weekdays' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => {
                hapticSelect()
                setScheduleType('weekdays')
              }}
            >
              {t.editor.byWeekdays}
            </button>
            <button
              className={scheduleType === 'frequency' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => {
                hapticSelect()
                setScheduleType('frequency')
              }}
            >
              {t.editor.byFrequency}
            </button>
          </div>

          {scheduleType === 'weekdays' ? (
            <div className={styles.days}>
              {ALL_WEEKDAYS.map((day) => (
                <button
                  key={day}
                  className={days.includes(day) ? `${styles.day} ${styles.dayOn}` : styles.day}
                  onClick={() => toggleDay(day)}
                  aria-pressed={days.includes(day)}
                >
                  {weekdayShort(day, settings.lang)}
                </button>
              ))}
            </div>
          ) : (
            <Stepper
              label={t.editor.timesPerWeek}
              value={timesPerWeek}
              min={1}
              max={7}
              onChange={setTimesPerWeek}
            />
          )}
        </section>

        <section className={styles.block}>
          <h3 className={styles.heading}>{t.timer.duration}</h3>
          <p className={styles.hint}>{t.timer.durationHint}</p>
          <DurationPicker
            value={durationSec}
            labels={{ minutes: t.timer.minutes, seconds: t.timer.seconds, off: t.timer.durationOff }}
            onChange={setDurationSec}
          />
        </section>

        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.goal}</h3>
          <Stepper
            label={streakGoal === null ? t.editor.goalOff : t.editor.goalHint}
            value={streakGoal ?? 0}
            min={0}
            max={365}
            step={streakGoal !== null && streakGoal >= 30 ? 10 : 1}
            // 0 означает «без цели»: отдельный переключатель для этого избыточен.
            onChange={(next) => setStreakGoal(next === 0 ? null : next)}
          />
        </section>

        {habit && (
          <button
            className={styles.deleteButton}
            onClick={() => {
              hapticWarning()
              setConfirmDelete(true)
            }}
          >
            <Icon name="close" size={18} />
            {t.common.delete}
          </button>
        )}
      </div>

      <Sheet open={iconSheet} title={t.editor.iconSheet} onClose={() => setIconSheet(false)}>
        <IconPicker
          value={icon}
          color={color}
          lang={settings.lang}
          onChange={(next) => {
            setIcon(next)
            setIconSheet(false)
          }}
          labels={{
            pickEmoji: t.editor.pickEmoji,
            emojiHint: t.editor.emojiHint,
            iconsHint: t.editor.iconsHint,
          }}
        />
      </Sheet>

      <Sheet open={colorSheet} title={t.editor.colorSheet} onClose={() => setColorSheet(false)}>
        <ColorPicker
          value={color}
          lang={settings.lang}
          onChange={(next) => {
            setColor(next)
            setColorSheet(false)
          }}
        />
      </Sheet>

      {confirmDelete && (
        <ConfirmDialog
          title={t.editor.deleteTitle}
          text={t.editor.deleteText}
          confirmLabel={t.editor.deleteConfirm}
          cancelLabel={t.common.cancel}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

