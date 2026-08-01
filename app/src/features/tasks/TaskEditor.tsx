import { useState } from 'react'
import type { Task, TaskInput, TaskPriority } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { todayIso } from '../../lib/dates'
import { TASK_COLORS } from '../../theme/palette'
import { hapticSelect, hapticSuccess, hapticWarning } from '../../lib/haptics'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DurationPicker } from '../../ui/DurationPicker'
import { Icon } from '../../ui/Icon'
import styles from './TaskEditor.module.css'

/**
 * Создание и редактирование задачи. Состав намеренно короткий: название, день,
 * время и приоритет — задача разовая, ей не нужны ни цвет, ни расписание.
 */
export function TaskEditor({ task, onClose }: { task: Task | null; onClose(): void }) {
  const { settings, createTask, updateTask, deleteTask } = useStore()
  const t = dict(settings.lang)

  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(task?.date ?? todayIso())
  const [time, setTime] = useState(task?.time ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal')
  const [durationSec, setDurationSec] = useState<number | null>(task?.durationSec ?? null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Форма красится в цвет выбранного приоритета — видно, какой будет карточка.
  const accent = TASK_COLORS[priority]

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      hapticWarning()
      setError(t.tasks.nameRequired)
      return
    }

    const input: TaskInput = {
      title: trimmed,
      date,
      // Пустая строка из поля времени — это «без времени», а не «00:00».
      time: time === '' ? null : time,
      priority,
      durationSec,
    }

    if (task) await updateTask(task.id, input)
    else await createTask(input)

    hapticSuccess()
    onClose()
  }

  const handleDelete = async () => {
    if (!task) return
    await deleteTask(task.id)
    onClose()
  }

  return (
    <div className={styles.screen} style={{ '--habit': accent } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.cancel} onClick={onClose}>
          {t.common.cancel}
        </button>
        <h2 className={styles.title}>{task ? t.tasks.editTitle : t.tasks.newTitle}</h2>
        <button className={styles.save} onClick={handleSave}>
          {t.common.save}
        </button>
      </header>

      <div className={styles.content}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.tasks.name}</span>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setError(null)
            }}
            placeholder={t.tasks.namePlaceholder}
            maxLength={100}
            autoFocus={!task}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t.tasks.date}</span>
            <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t.tasks.time}</span>
            <input className={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        {time !== '' && (
          <button className={styles.clearTime} onClick={() => setTime('')}>
            {t.tasks.timeOff}
          </button>
        )}

        <section className={styles.block}>
          <h3 className={styles.heading}>{t.tasks.priority}</h3>
          <div className={styles.segment}>
            <button
              className={priority === 'normal' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => {
                hapticSelect()
                setPriority('normal')
              }}
            >
              {t.tasks.priorityNormal}
            </button>
            <button
              className={priority === 'important' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => {
                hapticSelect()
                setPriority('important')
              }}
            >
              {t.tasks.priorityImportant}
            </button>
          </div>
        </section>

        <section className={styles.block}>
          <h3 className={styles.heading}>{t.timer.duration}</h3>
          <DurationPicker
            value={durationSec}
            labels={{ minutes: t.timer.minutes, seconds: t.timer.seconds, off: t.timer.durationOff }}
            onChange={setDurationSec}
          />
        </section>

        {task && (
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

      {confirmDelete && (
        <ConfirmDialog
          title={t.tasks.deleteTitle}
          text={t.tasks.deleteText}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
