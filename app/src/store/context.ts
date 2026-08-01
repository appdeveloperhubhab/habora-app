import { createContext, useContext } from 'react'
import type { Entry, Habit, HabitInput, IsoDate, Settings, Task, TaskInput } from '../types'
import type { Milestone } from '../lib/milestones'

export interface StoreValue {
  ready: boolean
  habits: Habit[]
  entries: Entry[]
  tasks: Task[]
  settings: Settings

  /** Быстрая проверка «день отмечен» без перебора массива отметок. */
  isDone(habitId: string, date: IsoDate): boolean
  /** Все отмеченные дни одной привычки, по возрастанию даты. */
  datesOf(habitId: string): IsoDate[]
  /** Дни, в которые была хоть какая-то активность — отметка привычки или выполненная задача. */
  activeDates: IsoDate[]

  toggleEntry(habitId: string, date: IsoDate): Promise<void>
  createHabit(input: HabitInput): Promise<Habit>
  updateHabit(id: string, patch: Partial<HabitInput>): Promise<void>
  deleteHabit(id: string): Promise<void>
  reorderHabits(ids: string[]): Promise<void>

  createTask(input: TaskInput): Promise<Task>
  updateTask(id: string, patch: Partial<TaskInput>): Promise<void>
  deleteTask(id: string): Promise<void>
  toggleTask(id: string): Promise<void>

  saveSettings(patch: Partial<Settings>): Promise<void>

  /** Веха, которую нужно отпраздновать прямо сейчас; null — праздновать нечего. */
  celebration: Milestone | null
  dismissCelebration(): void
}

export const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside <StoreProvider>')
  return value
}
