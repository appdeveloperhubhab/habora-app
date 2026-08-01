import { createClient } from '@libsql/client'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * База данных на SQLite через libSQL.
 *
 * Локально (без переменных TURSO_*) libSQL просто пишет в файл на диске —
 * работает как обычный SQLite, ничего дополнительно настраивать не нужно.
 * В проде те же переменные указывают на облачную базу Turso: данные живут
 * не на диске хостинга, а отдельно, и не пропадают при перезапуске сервера.
 *
 * Все данные привязаны к `user_id` — числовому идентификатору пользователя
 * Telegram. Каждый видит только свои строки: запросы всегда фильтруют по нему.
 */

const DB_PATH = process.env.DB_PATH ?? './data/habora.db'
const TURSO_URL = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_URL) {
  mkdirSync(dirname(DB_PATH), { recursive: true })
}

export const db = createClient(
  TURSO_URL ? { url: TURSO_URL, authToken: TURSO_TOKEN } : { url: `file:${DB_PATH}` },
)

await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS habits (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    color        TEXT    NOT NULL,
    icon         TEXT    NOT NULL,
    schedule     TEXT    NOT NULL,
    streak_goal  INTEGER,
    tinted       INTEGER NOT NULL DEFAULT 1,
    duration_sec INTEGER,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_habits_user ON habits (user_id, sort_order);

  CREATE TABLE IF NOT EXISTS entries (
    user_id  INTEGER NOT NULL,
    habit_id TEXT    NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    date     TEXT    NOT NULL,
    PRIMARY KEY (habit_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_user ON entries (user_id, date);

  CREATE TABLE IF NOT EXISTS tasks (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    title        TEXT    NOT NULL,
    date         TEXT    NOT NULL,
    time         TEXT,
    priority     TEXT    NOT NULL DEFAULT 'normal',
    duration_sec INTEGER,
    done_at      TEXT,
    created_at   TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_id, date);

  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY,
    data    TEXT NOT NULL
  );
`)

/**
 * Привычка из базы в тот же вид, что ждёт приложение.
 * Расписание хранится строкой JSON — в SQLite нет своего типа для объектов.
 */
export function rowToHabit(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    schedule: JSON.parse(row.schedule),
    streakGoal: row.streak_goal,
    // В SQLite нет отдельного булева типа — хранится 0 или 1.
    tinted: row.tinted === 1,
    durationSec: row.duration_sec,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

export function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    priority: row.priority,
    durationSec: row.duration_sec,
    doneAt: row.done_at,
    createdAt: row.created_at,
  }
}
