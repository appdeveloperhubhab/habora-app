import type { Entry, Habit, HabitInput, IsoDate, Settings, Task, TaskInput } from '../types'
import { initData } from '../lib/telegram'
import { normalizeSettings, type DataSource } from './datasource'

/**
 * Хранилище на сервере. Подключается, когда приложение открыто внутри Telegram
 * и задан адрес API.
 *
 * Авторизация — подписанная строка `initData` от Telegram в заголовке каждого
 * запроса. Сервер проверяет подпись токеном бота и по ней понимает, чьи данные
 * отдавать. Ни логинов, ни паролей: аккаунт — это аккаунт Telegram.
 */
export class ApiDataSource implements DataSource {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        // Только когда тело действительно есть: на запрос без тела, но с этим
        // заголовком сервер отвечает 400 — он ждёт JSON и не находит его.
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        'X-Telegram-Init-Data': initData(),
        ...init?.headers,
      },
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`${response.status} ${path}: ${detail}`)
    }

    return response.json() as Promise<T>
  }

  getHabits() {
    return this.request<Habit[]>('/api/habits')
  }

  createHabit(input: HabitInput) {
    return this.request<Habit>('/api/habits', { method: 'POST', body: JSON.stringify(input) })
  }

  updateHabit(id: string, patch: Partial<HabitInput>) {
    return this.request<Habit>(`/api/habits/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  async deleteHabit(id: string) {
    await this.request(`/api/habits/${id}`, { method: 'DELETE' })
  }

  reorderHabits(ids: string[]) {
    return this.request<Habit[]>('/api/habits/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  getEntries(range?: { from: IsoDate; to: IsoDate }) {
    const query = range ? `?from=${range.from}&to=${range.to}` : ''
    return this.request<Entry[]>(`/api/entries${query}`)
  }

  async toggleEntry(habitId: string, date: IsoDate) {
    const result = await this.request<{ done: boolean }>('/api/entries/toggle', {
      method: 'POST',
      body: JSON.stringify({ habitId, date }),
    })
    return result.done
  }

  getTasks() {
    return this.request<Task[]>('/api/tasks')
  }

  createTask(input: TaskInput) {
    return this.request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
  }

  updateTask(id: string, patch: Partial<TaskInput>) {
    return this.request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  async deleteTask(id: string) {
    await this.request(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  toggleTask(id: string) {
    return this.request<Task>(`/api/tasks/${id}/toggle`, { method: 'POST' })
  }

  async getSettings() {
    return normalizeSettings(await this.request<Settings>('/api/settings'))
  }

  saveSettings(patch: Partial<Settings>) {
    return this.request<Settings>('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) })
  }

  async recordVisit() {
    // Часовой пояс телефона: сервер живёт по всемирному времени и без этой
    // поправки прислал бы вечернее напоминание кому-то среди ночи. Знает его
    // только само приложение — в данных Telegram часового пояса нет.
    await this.request('/api/visit', {
      method: 'POST',
      body: JSON.stringify({ tzOffset: -new Date().getTimezoneOffset() }),
    })
  }
}
