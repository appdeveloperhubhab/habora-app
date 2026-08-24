import { createContext, useContext } from 'react'
import type { Entry, Friend, Habit, HabitInput, IsoDate, Settings } from '../types'
import type { Milestone } from '../lib/milestones'
import type { MarkAction } from './datasource'

export interface StoreValue {
  ready: boolean
  /** Загрузка сорвалась — сервер не ответил. Показывается вместо пустого экрана. */
  failed: boolean
  /**
   * Владелец бота закрыл доступ этому аккаунту. Показывается вместо
   * приложения и не лечится повтором.
   */
  denied: boolean
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

  /** Набрана ли за день норма привычки. */
  isDone(habitId: string, date: IsoDate): boolean
  /** Сколько раз привычку выполнили в этот день. */
  countOf(habitId: string, date: IsoDate): number
  /** Норма привычки — сколько раз в день её нужно выполнить. */
  targetOf(habitId: string): number
  /** Дни, в которые норма набрана, по возрастанию даты. Ими живёт вся аналитика. */
  datesOf(habitId: string): IsoDate[]
  /** Дни, в которые привычкой занимались, но норму не добрали. Только для показа. */
  partialDatesOf(habitId: string): IsoDate[]
  /** Дни, в которые была хоть какая-то активность — отметка привычки или выполненная задача. */
  activeDates: IsoDate[]

  markEntry(habitId: string, date: IsoDate, action?: MarkAction): Promise<void>
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
