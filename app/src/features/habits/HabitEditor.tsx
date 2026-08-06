import { useState } from 'react'
import type { Habit, HabitInput, Weekday } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { weekdayShort } from '../../lib/dates'
import { hapticSelect, hapticSuccess, hapticWarning } from '../../lib/haptics'
import { nextDefaultColor } from '../../theme/palette'
import { DEFAULT_HABIT_ICON } from '../../ui/habitIconSet'
import { HabitIcon } from '../../ui/habitIcons'
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
 * Форма намеренно короткая: набор иконок вынесен в отдельное окно, иначе он
 * занимал несколько экранов прокрутки и всё остальное терялось под ним.
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
  /*
   * У привычки, заведённой по старому расписанию «N раз в неделю», сохранённый
   * список дней мог остаться от прежних правок и не значить ничего. Открываем
   * такую на всех семи днях: это ближайшее к «без ограничения по дням», и
   * человек снимет лишние сам.
   */
  const [days, setDays] = useState<Weekday[]>(
    habit && habit.schedule.type === 'weekdays' ? habit.schedule.days : ALL_WEEKDAYS,
  )
  const [streakGoal, setStreakGoal] = useState<number | null>(habit?.streakGoal ?? null)
  const [durationSec, setDurationSec] = useState<number | null>(habit?.durationSec ?? null)

  const [error, setError] = useState<string | null>(null)
  const [iconSheet, setIconSheet] = useState(false)
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
    if (days.length === 0) {
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
      // Расписание теперь всегда по дням недели. `timesPerWeek` остаётся в типе
      // ради привычек, заведённых до этого, и хранит прежнее значение по
      // умолчанию — на расчёт серии у них оно уже не влияет.
      schedule: { type: 'weekdays', days, timesPerWeek: 3 },
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
          <ColorStrip value={color} onChange={setColor} />

          <div className={styles.tintRow}>
            <span className={styles.tintText}>
              <span className={styles.tintTitle}>{t.editor.tinted}</span>
              <span className={styles.tintHint}>{t.editor.tintedHint}</span>
            </span>
            <Toggle checked={tinted} color={color} onChange={setTinted} label={t.editor.tinted} />
          </div>
        </div>

        {/* У поля есть подпись, а не только placeholder: без неё было
            непонятно, что вообще сюда пишут, — «Необязательно» отвечало,
            что заполнять не обязательно, но не отвечало, что именно. */}
        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.description}</h3>
          <input
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.editor.descriptionPlaceholder}
            maxLength={120}
          />
        </section>

        {/* Только дни недели. Прежний второй режим — «N раз в неделю» —
            убран: он задавал ту же привычку вторым способом, а серия по нему
            считалась в неделях, и две привычки рядом показывали числа,
            которые нельзя сравнить между собой. */}
        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.schedule}</h3>
          <p className={styles.hint}>{t.editor.scheduleHint}</p>

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
          onChange={(next) => {
            setIcon(next)
            setIconSheet(false)
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

