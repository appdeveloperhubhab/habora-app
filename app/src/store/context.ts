import { createContext, useContext } from 'react'
import type { Entry, Friend, Habit, HabitInput, IsoDate, Settings } from '../types'
import type { Milestone } from '../lib/milestones'

export interface StoreValue {
  ready: boolean
  /** Загрузка сорвалась — сервер не ответил. Показывается вместо пустого экрана. */
  failed: boolean
  /** Повторить загрузку после неудачи. */
  retry(): void
  habits: Habit[]
  entries: Entry[]
  settings: Settings
  /** Люди, с которыми есть общие привычки. Вне Telegram список всегда пуст. */
  friends: Friend[]
  /** Перечитать друзей: их отметки меняются на их стороне, сами собой не придут. */
  refreshFriends(): Promise<void>
  /**
   * Ссылка-приглашение в привычку; null — приглашать некуда, приложение
   * работает без сервера.
   */
  inviteLink(habitId: string): Promise<string | null>

  /** Быстрая проверка «день отмечен» без перебора массива отметок. */
  isDone(habitId: string, date: IsoDate): boolean
  /** Все отмеченные дни одной привычки, по возрастанию даты. */
  datesOf(habitId: string): IsoDate[]
  /** Дни, в которые была хоть какая-то активность — отметка привычки или выполненная задача. */
  activeDates: IsoDate[]

  toggleEntry(habitId: string, date: IsoDate): Promise<void>
  createHabit(input: HabitInput): Promise<Habit>
  updateHabit(id: string, patch: Partial<HabitInput>): Promise<void>
  setReminder(id: string, remindAt: string | null): Promise<void>
  deleteHabit(id: string): Promise<void>
  reorderHabits(ids: string[]): Promise<void>

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
