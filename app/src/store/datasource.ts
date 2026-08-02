import type { Entry, Habit, HabitInput, IsoDate, Settings, Task, TaskInput } from '../types'

/**
 * Единственный способ, которым интерфейс общается с хранилищем.
 *
 * Реализации две: `LocalDataSource` (localStorage, этапы M0–M6) и
 * `ApiDataSource` (запросы к серверу, M7). Ни один компонент не должен
 * обращаться к хранилищу мимо этого интерфейса — иначе при подключении
 * бэкенда пришлось бы переписывать весь UI.
 *
 * Методы асинхронные даже в локальной реализации: так переход на сеть
 * не меняет ни одной сигнатуры.
 */
export interface DataSource {
  getHabits(): Promise<Habit[]>
  createHabit(input: HabitInput): Promise<Habit>
  updateHabit(id: string, patch: Partial<HabitInput>): Promise<Habit>
  deleteHabit(id: string): Promise<void>
  /** Новый порядок привычек, полным списком id сверху вниз. */
  reorderHabits(ids: string[]): Promise<Habit[]>

  /** Отметки за период; без аргументов — вся история (нужна аналитике). */
  getEntries(range?: { from: IsoDate; to: IsoDate }): Promise<Entry[]>
  /** Переключает отметку за день. Возвращает новое состояние: true — выполнено. */
  toggleEntry(habitId: string, date: IsoDate): Promise<boolean>

  getTasks(): Promise<Task[]>
  createTask(input: TaskInput): Promise<Task>
  updateTask(id: string, patch: Partial<TaskInput>): Promise<Task>
  deleteTask(id: string): Promise<void>
  toggleTask(id: string): Promise<Task>

  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>

  /**
   * Отметить факт открытия приложения. Есть только у серверной реализации:
   * в localStorage считать заходы не для кого — данные видит один человек.
   */
  recordVisit?(): Promise<void>
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  lang: 'ru',
  accentColor: '#6c5ce7',
  cardView: 'week',
  backgroundKind: 'none',
  gradientFrom: '#2b1055',
  gradientTo: '#7597de',
  onboarded: false,
  celebrated: [],
  hintSeen: false,
  timer: null,
}

/**
 * Приводит прочитанные настройки к тому, что приложение умеет показывать.
 *
 * У тех, кто успел выбрать подсветку акцентом или фотографию, в хранилище
 * остался вид фона, которого больше нет. Без приведения такой человек увидел
 * бы в настройках список, где не выбрано ничего.
 */
export function normalizeSettings(settings: Settings): Settings {
  const known: Settings['backgroundKind'][] = ['none', 'gradient']
  if (known.includes(settings.backgroundKind)) return settings
  return { ...settings, backgroundKind: 'none' }
}
