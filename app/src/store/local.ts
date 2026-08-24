import type { Entry, Habit, HabitInput, IsoDate, Settings } from '../types'
import { DEFAULT_SETTINGS, normalizeSettings, type DataSource, type MarkAction } from './datasource'

/**
 * Хранилище на localStorage. Работает до подключения бэкенда (M7) и остаётся
 * запасным вариантом, если приложение открыли вне Telegram.
 */

const PREFIX = 'habora.v1.'
const KEY_HABITS = `${PREFIX}habits`
const KEY_ENTRIES = `${PREFIX}entries`
const KEY_SETTINGS = `${PREFIX}settings`

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    // Повреждённая запись не должна ронять приложение — начинаем с пустого.
    return fallback
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function newId(): string {
  return crypto.randomUUID()
}

function entryKey(habitId: string, date: IsoDate): string {
  return `${habitId}|${date}`
}

export class LocalDataSource implements DataSource {
  async getHabits(): Promise<Habit[]> {
    return read<Habit[]>(KEY_HABITS, [])
      // Привычки, заведённые до появления настройки тонировки, таймера и
      // напоминания, читаются без этих полей — подставляем прежнее поведение.
      .map((habit) => ({
        ...habit,
        tinted: habit.tinted ?? true,
        durationSec: habit.durationSec ?? null,
        remindAt: habit.remindAt ?? null,
        target: habit.target ?? 1,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async createHabit(input: HabitInput): Promise<Habit> {
    const habits = read<Habit[]>(KEY_HABITS, [])
    const habit: Habit = {
      ...input,
      id: newId(),
      sortOrder: habits.length,
      createdAt: new Date().toISOString(),
    }
    write(KEY_HABITS, [...habits, habit])
    return habit
  }

  async updateHabit(id: string, patch: Partial<HabitInput>): Promise<Habit> {
    const habits = read<Habit[]>(KEY_HABITS, [])
    const index = habits.findIndex((h) => h.id === id)
    if (index === -1) throw new Error(`Habit ${id} not found`)

    const updated = { ...habits[index], ...patch }
    habits[index] = updated
    write(KEY_HABITS, habits)
    return updated
  }

  async setReminder(id: string, remindAt: string | null): Promise<void> {
    const habits = read<Habit[]>(KEY_HABITS, [])
    write(KEY_HABITS, habits.map((h) => (h.id === id ? { ...h, remindAt } : h)))
  }

  async deleteHabit(id: string): Promise<void> {
    write(
      KEY_HABITS,
      read<Habit[]>(KEY_HABITS, []).filter((h) => h.id !== id),
    )
    // Отметки удалённой привычки больше никому не нужны — чистим сразу,
    // иначе они копятся в хранилище навсегда.
    write(
      KEY_ENTRIES,
      read<Entry[]>(KEY_ENTRIES, []).filter((e) => e.habitId !== id),
    )
  }

  async reorderHabits(ids: string[]): Promise<Habit[]> {
    const habits = read<Habit[]>(KEY_HABITS, [])
    const position = new Map(ids.map((id, i) => [id, i]))
    const reordered = habits
      .map((h) => ({ ...h, sortOrder: position.get(h.id) ?? h.sortOrder }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    write(KEY_HABITS, reordered)
    return reordered
  }

  async getEntries(range?: { from: IsoDate; to: IsoDate }): Promise<Entry[]> {
    // Отметки, записанные до появления счётчика, читаются как один раз.
    const entries = read<Entry[]>(KEY_ENTRIES, []).map((entry) => ({
      ...entry,
      count: entry.count ?? 1,
    }))
    if (!range) return entries
    return entries.filter((e) => e.date >= range.from && e.date <= range.to)
  }

  async markEntry(habitId: string, date: IsoDate, action: MarkAction): Promise<number> {
    const entries = read<Entry[]>(KEY_ENTRIES, [])
    const key = entryKey(habitId, date)
    const index = entries.findIndex((e) => entryKey(e.habitId, e.date) === key)

    // Отметки, записанные до появления счётчика, читаются как один раз.
    const before = index === -1 ? 0 : (entries[index].count ?? 1)

    const habits = read<Habit[]>(KEY_HABITS, [])
    const target = Math.max(1, habits.find((habit) => habit.id === habitId)?.target ?? 1)

    const after =
      action === 'full'
        ? target
        : action === 'clear'
          ? 0
          : action === 'dec'
            ? Math.max(0, before - 1)
            : Math.min(target, before + 1)

    if (after === before) return after

    if (after === 0) entries.splice(index, 1)
    else if (index === -1) entries.push({ habitId, date, count: after })
    else entries[index] = { habitId, date, count: after }

    write(KEY_ENTRIES, entries)
    return after
  }

  async getSettings(): Promise<Settings> {
    // Раскладываем поверх значений по умолчанию: если в новой версии
    // приложения появилась настройка, старая сохранённая запись не сломается.
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEY_SETTINGS, {}) })
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const settings = { ...(await this.getSettings()), ...patch }
    write(KEY_SETTINGS, settings)
    return settings
  }
}
