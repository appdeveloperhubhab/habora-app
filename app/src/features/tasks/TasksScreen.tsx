import { useMemo, useState } from 'react'
import type { Task } from '../../types'
import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { todayIso } from '../../lib/dates'
import { hapticWarning } from '../../lib/haptics'
import { startTimer } from '../../lib/timer'
import { EmptyState } from '../../ui/EmptyState'
import { ActionSheet } from '../../ui/ActionSheet'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TaskCard } from './TaskCard'
import styles from './TasksScreen.module.css'

/**
 * Задачи на сегодня.
 *
 * Невыполненная задача не переносится на следующий день и не исчезает: она
 * остаётся отдельной группой «Просроченные» до тех пор, пока пользователь сам
 * её не закроет или не удалит.
 */

/** Внутри группы: сначала по времени, задачи без времени — в конце, важные выше. */
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.time !== b.time) {
      if (a.time === null) return 1
      if (b.time === null) return -1
      return a.time < b.time ? -1 : 1
    }
    if (a.priority !== b.priority) return a.priority === 'important' ? -1 : 1
    return a.createdAt < b.createdAt ? -1 : 1
  })
}

export function TasksScreen({ query = '' }: { query?: string }) {
  const { tasks, settings, toggleTask, deleteTask, saveSettings } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)
  const today = todayIso()

  const [menuFor, setMenuFor] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [replacingTimer, setReplacingTimer] = useState<Task | null>(null)

  const runTimer = (task: Task) => {
    if (!task.durationSec) return
    void saveSettings({ timer: startTimer('task', task.id, task.durationSec) })
    nav.push({ name: 'timer' })
  }

  const startTimerFor = (task: Task) => {
    // Таймер этой же задачи уже идёт — открываем его, а не запускаем заново.
    if (settings.timer?.id === task.id) {
      nav.push({ name: 'timer' })
      return
    }
    // Одновременно идёт только один отсчёт — на всё приложение, а не на раздел.
    if (settings.timer) {
      setReplacingTimer(task)
      return
    }
    runTimer(task)
  }

  const needle = query.trim().toLowerCase()

  const groups = useMemo(() => {
    const matching = needle ? tasks.filter((task) => task.title.toLowerCase().includes(needle)) : tasks
    const open = matching.filter((task) => task.doneAt === null)
    return {
      total: matching.length,
      overdue: sortTasks(open.filter((task) => task.date < today)),
      today: sortTasks(open.filter((task) => task.date === today)),
      upcoming: sortTasks(open.filter((task) => task.date > today)),
      done: sortTasks(matching.filter((task) => task.doneAt !== null)),
    }
  }, [tasks, today, needle])

  if (tasks.length === 0) {
    return <EmptyState title={t.tasks.empty} hint={t.tasks.emptyHint} />
  }

  if (groups.total === 0) {
    return <EmptyState title={t.common.notFound} hint={t.common.notFoundHint} />
  }

  const renderGroup = (title: string, list: Task[], overdue = false) => {
    if (list.length === 0) return null
    return (
      <section className={styles.group}>
        <h3 className={styles.groupTitle}>{title}</h3>
        <div className={styles.list}>
          {list.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              overdue={overdue}
              overdueLabel={t.tasks.overdue}
              onToggle={() => void toggleTask(task.id)}
              onOpen={() => setMenuFor(task)}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <div className={styles.screen}>
        {renderGroup(t.tasks.overdueGroup, groups.overdue, true)}
        {renderGroup(t.tasks.todayGroup, groups.today)}
        {renderGroup(t.tasks.upcomingGroup, groups.upcoming)}
        {renderGroup(t.tasks.doneGroup, groups.done)}
      </div>

      <ActionSheet
        open={menuFor !== null}
        title={menuFor?.title}
        cancelLabel={t.common.cancel}
        onClose={() => setMenuFor(null)}
        actions={[
          // Таймер стоит первым: если у задачи задана длительность, это
          // самое частое действие — начать, а не переименовать.
          ...(menuFor?.durationSec
            ? [
                {
                  id: 'timer',
                  label: t.timer.start,
                  icon: 'play' as const,
                  onSelect: () => menuFor && startTimerFor(menuFor),
                },
              ]
            : []),
          {
            id: 'edit',
            label: t.actions.edit,
            icon: 'pencil' as const,
            onSelect: () => menuFor && nav.push({ name: 'taskEditor', taskId: menuFor.id }),
          },
          {
            id: 'delete',
            label: t.actions.delete,
            icon: 'close',
            danger: true,
            onSelect: () => {
              hapticWarning()
              setDeleting(menuFor)
            },
          },
        ]}
      />

      {replacingTimer && (
        <ConfirmDialog
          title={t.timer.replaceTitle}
          text={t.timer.replaceText}
          confirmLabel={t.timer.replaceConfirm}
          cancelLabel={t.common.cancel}
          onCancel={() => setReplacingTimer(null)}
          onConfirm={() => {
            runTimer(replacingTimer)
            setReplacingTimer(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t.tasks.deleteTitle}
          text={t.tasks.deleteText}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void deleteTask(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </>
  )
}
