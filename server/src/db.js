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

  CREATE TABLE IF NOT EXISTS users (
    user_id    INTEGER PRIMARY KEY,
    first_name TEXT    NOT NULL DEFAULT '',
    username   TEXT,
    language   TEXT,
    first_seen TEXT    NOT NULL,
    last_seen  TEXT    NOT NULL,
    opens      INTEGER NOT NULL DEFAULT 1
  );
`)

/**
 * Досыпает столбец в уже созданную таблицу.
 *
 * `CREATE TABLE IF NOT EXISTS` выше трогает только пустую базу: там, где
 * таблица уже есть, новый столбец в описании остаётся на бумаге. Для баз,
 * заведённых до его появления, столбец приходится добавлять отдельно.
 *
 * `ADD COLUMN IF NOT EXISTS` в SQLite нет, поэтому сначала спрашиваем состав
 * таблицы: повторный запуск сервера не должен падать на уже добавленном.
 */
async function addColumnIfMissing(table, column, definition) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`)
  if (rows.some((row) => row.name === column)) return
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

await addColumnIfMissing('users', 'username', 'TEXT')

/*
 * Представления «кто это» — те же таблицы, но с именем и ником Telegram сразу
 * после user_id. Нужны, чтобы владелец бота, открыв базу, видел живого
 * человека, а не голый номер.
 *
 * Именно представления, а не отдельные столбцы в каждой таблице: имя и ник
 * лежали бы копией в каждой строке — в отметках это тысячи повторов одного
 * и того же, — и устаревали бы, стоит человеку сменить ник. Здесь они всегда
 * подтягиваются из users, то есть всегда свежие.
 *
 * Пересоздаются при каждом запуске: SQLite запоминает состав столбцов в момент
 * создания представления, и после добавления столбца в таблицу старое
 * представление про него не узнает. Стоит это ничего — за представлением нет
 * данных, только запрос.
 */
await db.executeMultiple(`
  DROP VIEW IF EXISTS view_habits;
  CREATE VIEW view_habits AS
    SELECT h.user_id, u.first_name, u.username,
           h.name, h.description, h.icon, h.color, h.schedule,
           h.streak_goal, h.tinted, h.duration_sec, h.sort_order, h.created_at, h.id
      FROM habits h
      LEFT JOIN users u ON u.user_id = h.user_id;

  DROP VIEW IF EXISTS view_entries;
  CREATE VIEW view_entries AS
    SELECT e.user_id, u.first_name, u.username,
           h.name AS habit_name, e.date, e.habit_id
      FROM entries e
      LEFT JOIN users u ON u.user_id = e.user_id
      LEFT JOIN habits h ON h.id = e.habit_id;

  DROP VIEW IF EXISTS view_tasks;
  CREATE VIEW view_tasks AS
    SELECT t.user_id, u.first_name, u.username,
           t.title, t.date, t.time, t.priority, t.duration_sec, t.done_at, t.created_at, t.id
      FROM tasks t
      LEFT JOIN users u ON u.user_id = t.user_id;

  DROP VIEW IF EXISTS view_settings;
  CREATE VIEW view_settings AS
    SELECT s.user_id, u.first_name, u.username, s.data
      FROM settings s
      LEFT JOIN users u ON u.user_id = s.user_id;
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
