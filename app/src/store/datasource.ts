import type { Entry, Friend, Habit, HabitInput, IsoDate, Settings } from '../types'

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
  /**
   * Данные лежат на сервере, а не в самом телефоне.
   *
   * От этого зависит, запоминать ли их между запусками: локальное хранилище
   * и так отвечает мгновенно, и копия копии ему не нужна.
   */
  readonly remote?: boolean

  getHabits(): Promise<Habit[]>
  createHabit(input: HabitInput): Promise<Habit>
  updateHabit(id: string, patch: Partial<HabitInput>): Promise<Habit>
  setReminder(id: string, remindAt: string | null): Promise<void>
  deleteHabit(id: string): Promise<void>
  /** Новый порядок привычек, полным списком id сверху вниз. */
  reorderHabits(ids: string[]): Promise<Habit[]>

  /** Отметки за период; без аргументов — вся история (нужна аналитике). */
  getEntries(range?: { from: IsoDate; to: IsoDate }): Promise<Entry[]>
  /** Переключает отметку за день. Возвращает новое состояние: true — выполнено. */
  toggleEntry(habitId: string, date: IsoDate): Promise<boolean>

  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>

  /**
   * Отметить факт открытия приложения. Есть только у серверной реализации:
   * в localStorage считать заходы не для кого — данные видит один человек.
   */
  recordVisit?(): Promise<void>

  /**
   * Люди, с которыми есть общие привычки. Тоже только на сервере: в локальном
   * хранилище других людей не бывает по устройству.
   */
  getFriends?(): Promise<Friend[]>

  /** Присоединиться к привычке по приглашению. */
  joinHabit?(habitId: string): Promise<void>

  /** Ссылка-приглашение в привычку; строит её сервер — он знает имя бота. */
  getInviteLink?(habitId: string): Promise<string>
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
  // По умолчанию включены: напоминание — половина смысла бота, и человек,
  // который его не хочет, скорее выключит одну настройку, чем тот, кто хочет,
  // догадается её найти и включить.
  reminders: true,
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
  let next = known.includes(settings.backgroundKind)
    ? settings
    : { ...settings, backgroundKind: 'none' as const }

  // Вид «плитка» заменён на «год». У тех, кто успел его выбрать, в хранилище
  // остался вид, которого больше нет: без замены список привычек не отрисовался
  // бы вовсе — показывать нечем.
  const views: Settings['cardView'][] = ['week', 'month', 'year']
  if (!views.includes(next.cardView)) next = { ...next, cardView: 'month' }

  // Таймер задачи мог остаться запущенным с тех пор, когда задачи ещё были:
  // экран отсчёта не нашёл бы, что именно идёт, и показал бы пустое имя.
  if (next.timer && next.timer.kind !== 'habit') return { ...next, timer: null }
  return next
}
