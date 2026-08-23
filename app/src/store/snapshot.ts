import type { Entry, Habit, Settings } from '../types'
import { currentUserId } from '../lib/telegram'

/**
 * Снимок данных с прошлого запуска.
 *
 * Нужен, чтобы приложение открывалось мгновенно. Раньше оно начинало с чистого
 * листа и ждало ответа сервера, прежде чем нарисовать хоть что-то, — а сервер
 * на бесплатном тарифе засыпает без посетителей и просыпается до полуминуты.
 * Всё это время человек смотрел на экран загрузки, хотя его привычки не
 * менялись с прошлого раза.
 *
 * Со снимком список рисуется сразу, а сервер спрашивается уже за кадром: пришёл
 * ответ — данные тихо обновились. Экран загрузки остаётся только для самого
 * первого запуска на этом телефоне, когда показывать действительно нечего.
 *
 * Снимок — не хранилище, а копия. Правда по-прежнему на сервере: любой его
 * ответ полностью заменяет снимок, и расхождения живут ровно до первого
 * успешного запроса.
 */

const KEY = 'habora.cache.v1'

export interface Snapshot {
  /** Чей это снимок: в одном Telegram можно войти разными аккаунтами. */
  userId: number
  habits: Habit[]
  entries: Entry[]
  settings: Settings
}

export function readSnapshot(): Snapshot | null {
  const me = currentUserId()
  if (me === null) return null

  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null

    const snapshot = JSON.parse(raw) as Snapshot
    if (snapshot.userId !== me) return null
    // Снимок мог остаться от версии, где данные лежали иначе. Показать половину
    // структуры хуже, чем подождать сервер: приложение упало бы на первом же
    // обращении к недостающему полю.
    if (!Array.isArray(snapshot.habits) || !Array.isArray(snapshot.entries)) return null
    if (!snapshot.settings || typeof snapshot.settings !== 'object') return null

    return snapshot
  } catch {
    return null
  }
}

/**
 * Стереть снимок.
 *
 * Нужен, когда сервер закрыл доступ: снимок пережил бы отказ, и приложение
 * продолжало бы показывать прежние привычки, ничего никуда не отправляя.
 */
export function clearSnapshot(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Недоступное хранилище — не повод ронять экран: показывать всё равно
    // будем отказ, а снимок без сервера ни во что не превратится.
  }
}

export function writeSnapshot(habits: Habit[], entries: Entry[], settings: Settings): void {
  const me = currentUserId()
  if (me === null) return

  try {
    localStorage.setItem(KEY, JSON.stringify({ userId: me, habits, entries, settings }))
  } catch {
    // Память под сайт могла кончиться. Снимок — ускорение, а не необходимость:
    // без него приложение просто откроется как раньше, через ожидание.
  }
}
