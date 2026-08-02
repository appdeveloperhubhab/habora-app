/** Дата без времени в локальной таймзоне пользователя: `YYYY-MM-DD`. */
export type IsoDate = string

/** День недели, 0 = понедельник … 6 = воскресенье. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Расписание привычки. Пользователь выбирает один из двух режимов:
 * конкретные дни недели либо просто число раз в неделю без привязки к дням.
 */
export type ScheduleType = 'weekdays' | 'frequency'

export interface HabitSchedule {
  type: ScheduleType
  /** Значимо при type === 'weekdays'. */
  days: Weekday[]
  /** Значимо при type === 'frequency'. */
  timesPerWeek: number
}

export interface Habit {
  id: string
  name: string
  description: string
  /** Индивидуальный цвет привычки в hex, из палитры. */
  color: string
  /** Эмодзи (например, `💧`) либо id иконки из встроенного набора (`ic:water`). */
  icon: string
  schedule: HabitSchedule
  /** Цель по длине серии в днях; null — цель не задана. */
  streakGoal: number | null
  /** Заливать ли карточку цветом привычки. Выключено — карточка нейтральная. */
  tinted: boolean
  /**
   * Длительность в секундах для привычек вроде «медитация 10 минут»
   * или «планка 40 секунд»; null — таймера нет.
   *
   * В секундах, а не в минутах: короткие упражнения измеряются десятками
   * секунд, и округление до минуты сделало бы таймер для них бесполезным.
   */
  durationSec: number | null
  sortOrder: number
  createdAt: string
}

export type HabitInput = Omit<Habit, 'id' | 'createdAt' | 'sortOrder'>

/**
 * Отметка выполнения за конкретный день. Хранится как факт: строка есть —
 * день выполнен, строки нет — не выполнен. Никаких счётчиков и флагов.
 */
export interface Entry {
  habitId: string
  date: IsoDate
}

export type TaskPriority = 'normal' | 'important'

export interface Task {
  id: string
  title: string
  /** День, на который назначена задача. */
  date: IsoDate
  /** Время в формате `HH:MM`; null — задача без привязки ко времени. */
  time: string | null
  priority: TaskPriority
  /** Длительность в секундах; null — таймера нет. */
  durationSec: number | null
  /** Момент выполнения (ISO datetime); null — не выполнена. */
  doneAt: string | null
  createdAt: string
}

/**
 * Запущенный таймер.
 *
 * Хранится момент старта, а не остаток: браузер останавливает счётчики в
 * неактивных вкладках, и таймер, уменьшающий остаток по тику, замирал бы,
 * как только приложение свернули. От времени старта остаток всегда можно
 * пересчитать заново.
 */
export interface ActiveTimer {
  kind: 'habit' | 'task'
  id: string
  startedAt: string
  durationSec: number
  /** Момент постановки на паузу; null — идёт. */
  pausedAt: string | null
  /** Сколько миллисекунд суммарно провели на паузе. */
  pausedMs: number
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'doneAt'>

export type ThemeMode = 'dark' | 'light'
export type Lang = 'ru' | 'en'

/**
 * Вид карточек в списке привычек. Применяется сразу ко всем привычкам,
 * переключается в режиме «Порядок».
 *
 * `month` — крупная карточка во всю ширину с сеткой и кнопкой «Отметить»,
 * `grid` — то же самое, но по две в ряд, `week` — узкая строка с неделей.
 */
export type CardView = 'month' | 'grid' | 'week'

/**
 * Фон приложения: чистый цвет темы или градиент из двух выбранных цветов.
 *
 * Были ещё подсветка акцентом и своя фотография — убраны как лишний выбор:
 * подсветка почти не отличалась от чистого фона, а фотография спорила с
 * карточками и мешала их читать.
 */
export type BackgroundKind = 'none' | 'gradient'

export interface Settings {
  theme: ThemeMode
  lang: Lang
  accentColor: string
  cardView: CardView
  backgroundKind: BackgroundKind
  gradientFrom: string
  gradientTo: string
  /** Пройден ли онбординг первого запуска. */
  onboarded: boolean
  /** Запущенный таймер; null — ничего не идёт. Одновременно может быть только один. */
  timer: ActiveTimer | null
  /** Ключи уже отпразднованных вех — чтобы не показывать салют повторно. */
  celebrated: string[]
  /** Видел ли пользователь подсказку у кнопки отметки. */
  hintSeen: boolean
}
