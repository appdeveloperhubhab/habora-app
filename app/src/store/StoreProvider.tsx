import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Entry, Habit, HabitInput, IsoDate, Settings, Task, TaskInput } from '../types'
import { telegramLang } from '../lib/telegram'
import { toIso } from '../lib/dates'
import { detectMilestone, type Milestone } from '../lib/milestones'
import { DEFAULT_SETTINGS, type DataSource } from './datasource'
import { pickDataSource } from './pickDataSource'
import { StoreContext, type StoreValue } from './context'

/**
 * Единое состояние приложения поверх `DataSource`.
 *
 * Все изменения применяются оптимистично: интерфейс обновляется сразу, запись
 * в хранилище идёт следом. Это принципиально для кнопки отметки — по ТЗ отклик
 * должен быть мгновенным, ждать ответа хранилища нельзя.
 */

function entryKey(habitId: string, date: IsoDate): string {
  return `${habitId}|${date}`
}

interface Props {
  children: ReactNode
  /** Явная подмена хранилища; обычно не нужна — выбор делает `pickDataSource`. */
  source?: DataSource
}

export function StoreProvider({ children, source }: Props) {
  const dataSource = useRef(source ?? pickDataSource()).current

  const [ready, setReady] = useState(false)
  const [habits, setHabits] = useState<Habit[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [celebration, setCelebration] = useState<Milestone | null>(null)

  // `saveSettings` объявлена ниже, а нужна уже в `toggleEntry`. Ссылка
  // разрывает циклическую зависимость между ними.
  const saveSettingsRef = useRef<(patch: Partial<Settings>) => Promise<void>>(async () => {})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [loadedHabits, loadedEntries, loadedTasks, loadedSettings] = await Promise.all([
        dataSource.getHabits(),
        dataSource.getEntries(),
        dataSource.getTasks(),
        dataSource.getSettings(),
      ])
      if (cancelled) return

      // При самом первом запуске подхватываем из Telegram язык — но не тему:
      // стартовая тема Habora по ТЗ тёмная, и светлый клиент Telegram не должен
      // её переопределять. Дальше и то и другое решает пользователь.
      let initial = loadedSettings
      if (!loadedSettings.onboarded) {
        const lang = telegramLang()
        if (lang) initial = { ...loadedSettings, lang }
      }

      setHabits(loadedHabits)
      setEntries(loadedEntries)
      setTasks(loadedTasks)
      setSettings(initial)
      setReady(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dataSource])

  const doneKeys = useMemo(() => new Set(entries.map((e) => entryKey(e.habitId, e.date))), [entries])

  const isDone = useCallback(
    (habitId: string, date: IsoDate) => doneKeys.has(entryKey(habitId, date)),
    [doneKeys],
  )

  const datesByHabit = useMemo(() => {
    const map = new Map<string, IsoDate[]>()
    for (const entry of entries) {
      const list = map.get(entry.habitId)
      if (list) list.push(entry.date)
      else map.set(entry.habitId, [entry.date])
    }
    for (const list of map.values()) list.sort()
    return map
  }, [entries])

  const datesOf = useCallback((habitId: string) => datesByHabit.get(habitId) ?? [], [datesByHabit])

  /**
   * Дни с любой активностью — для общей серии приложения.
   * У задачи берём день, когда её реально закрыли, а не на который она была
   * назначена: просроченная задача, выполненная сегодня, — это сегодняшняя активность.
   */
  const activeDates = useMemo(() => {
    const days = new Set(entries.map((entry) => entry.date))
    for (const task of tasks) {
      if (task.doneAt) days.add(toIso(new Date(task.doneAt)))
    }
    return [...days]
  }, [entries, tasks])

  const toggleEntry = useCallback(
    async (habitId: string, date: IsoDate) => {
      const key = entryKey(habitId, date)
      const wasDone = doneKeys.has(key)
      const nextEntries = wasDone
        ? entries.filter((e) => entryKey(e.habitId, e.date) !== key)
        : [...entries, { habitId, date }]

      setEntries(nextEntries)

      // Вехи проверяем только при простановке отметки: снятие галочки —
      // не повод для салюта.
      if (!wasDone) {
        const habit = habits.find((h) => h.id === habitId)
        if (habit) {
          const found = detectMilestone({
            habit,
            habitDates: nextEntries
              .filter((e) => e.habitId === habitId)
              .map((e) => e.date)
              .sort(),
            activeDates: [...new Set([...activeDates, date])],
            totalEntries: nextEntries.length,
            celebrated: settings.celebrated,
          })

          if (found) {
            setCelebration(found)
            // Запоминаем сразу: иначе повторная простановка той же галочки
            // покажет тот же салют ещё раз.
            void saveSettingsRef.current({ celebrated: [...settings.celebrated, found.key] })
          }
        }
      }

      try {
        await dataSource.toggleEntry(habitId, date)
      } catch {
        // Запись не прошла — возвращаем интерфейс к тому, что реально в хранилище.
        setEntries(await dataSource.getEntries())
      }
    },
    [dataSource, doneKeys, entries, habits, activeDates, settings.celebrated],
  )

  const createHabit = useCallback(
    async (input: HabitInput) => {
      const habit = await dataSource.createHabit(input)
      setHabits((prev) => [...prev, habit])
      return habit
    },
    [dataSource],
  )

  const updateHabit = useCallback(
    async (id: string, patch: Partial<HabitInput>) => {
      const updated = await dataSource.updateHabit(id, patch)
      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)))
    },
    [dataSource],
  )

  const deleteHabit = useCallback(
    async (id: string) => {
      await dataSource.deleteHabit(id)
      setHabits((prev) => prev.filter((h) => h.id !== id))
      setEntries((prev) => prev.filter((e) => e.habitId !== id))
    },
    [dataSource],
  )

  const reorderHabits = useCallback(
    async (ids: string[]) => {
      setHabits(await dataSource.reorderHabits(ids))
    },
    [dataSource],
  )

  const createTask = useCallback(
    async (input: TaskInput) => {
      const task = await dataSource.createTask(input)
      setTasks((prev) => [...prev, task])
      return task
    },
    [dataSource],
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<TaskInput>) => {
      const updated = await dataSource.updateTask(id, patch)
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
    },
    [dataSource],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      await dataSource.deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    },
    [dataSource],
  )

  const toggleTask = useCallback(
    async (id: string) => {
      const now = new Date().toISOString()
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, doneAt: t.doneAt ? null : now } : t)))
      try {
        await dataSource.toggleTask(id)
      } catch {
        setTasks(await dataSource.getTasks())
      }
    },
    [dataSource],
  )

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }))
      await dataSource.saveSettings(patch)
    },
    [dataSource],
  )

  saveSettingsRef.current = saveSettings

  const dismissCelebration = useCallback(() => setCelebration(null), [])

  const value: StoreValue = useMemo(
    () => ({
      ready,
      habits,
      entries,
      tasks,
      settings,
      isDone,
      datesOf,
      activeDates,
      toggleEntry,
      createHabit,
      updateHabit,
      deleteHabit,
      reorderHabits,
      createTask,
      updateTask,
      deleteTask,
      toggleTask,
      saveSettings,
      celebration,
      dismissCelebration,
    }),
    [
      ready, habits, entries, tasks, settings,
      isDone, datesOf, activeDates, toggleEntry,
      createHabit, updateHabit, deleteHabit, reorderHabits,
      createTask, updateTask, deleteTask, toggleTask,
      saveSettings, celebration, dismissCelebration,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
