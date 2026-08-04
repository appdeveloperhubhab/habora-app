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

  /*
   * Участники привычки. У обычной привычки участник один — тот, кто её завёл;
   * у совместной их несколько, и каждый отмечается за себя.
   *
   * Столбец habits.user_id остаётся: это создатель. Он решает судьбу привычки —
   * переименовать и удалить может только он, иначе двое правили бы одно и то же.
   */
  CREATE TABLE IF NOT EXISTS habit_members (
    habit_id   TEXT    NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL,
    -- Порядок в списке личный: друг переставил карточки у себя — у вас ничего
    -- не сдвинулось.
    sort_order INTEGER NOT NULL DEFAULT 0,
    joined_at  TEXT    NOT NULL,
    PRIMARY KEY (habit_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_members_user ON habit_members (user_id);

  CREATE TABLE IF NOT EXISTS entries (
    user_id  INTEGER NOT NULL,
    habit_id TEXT    NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    date     TEXT    NOT NULL,
    PRIMARY KEY (habit_id, user_id, date)
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
    user_id      INTEGER PRIMARY KEY,
    first_name   TEXT    NOT NULL DEFAULT '',
    username     TEXT,
    language     TEXT,
    first_seen   TEXT    NOT NULL,
    last_seen    TEXT    NOT NULL,
    opens        INTEGER NOT NULL DEFAULT 1,
    chat_started INTEGER NOT NULL DEFAULT 0,
    tz_offset    INTEGER,
    reminded_on  TEXT
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
 * Столбцы для бота.
 *
 * `chat_started` — нажимал ли человек «Старт». Telegram запрещает боту писать
 * первым, и без этой отметки напоминание просто не дойдёт: рассылать всем
 * подряд — значит получать ошибку на каждом втором.
 *
 * `tz_offset` — на сколько минут его время впереди всемирного. Сервер живёт по
 * UTC, а «вечер» у каждого свой: без поправки напоминание приходило бы кому-то
 * среди ночи. Значение присылает само приложение — только оно знает часовой
 * пояс телефона.
 *
 * `reminded_on` — дата последнего напоминания по местному времени человека.
 * Будильник дёргает сервер каждые несколько минут, и без этой отметки один и
 * тот же вечер рассылался бы десятки раз.
 */
await addColumnIfMissing('users', 'chat_started', 'INTEGER NOT NULL DEFAULT 0')
await addColumnIfMissing('users', 'tz_offset', 'INTEGER')
await addColumnIfMissing('users', 'reminded_on', 'TEXT')

/** Аватарка из Telegram — чтобы на общей привычке было видно лица, а не имена. */
await addColumnIfMissing('users', 'photo_url', 'TEXT')

/*
 * Представления снимаются перед переездами таблиц и создаются заново в конце.
 *
 * Представление хранит запрос, а не данные, и продолжает ссылаться на таблицу,
 * которую переезд пересоздаёт. Оставленное на месте, оно ломает саму миграцию:
 * SQLite отказывается менять схему, пока на неё смотрит нерабочий запрос.
 */
await db.executeMultiple(`
  DROP VIEW IF EXISTS view_habits;
  DROP VIEW IF EXISTS view_entries;
  DROP VIEW IF EXISTS view_tasks;
  DROP VIEW IF EXISTS view_settings;
  DROP VIEW IF EXISTS view_members;
`)

/*
 * Переезд отметок на ключ с участником.
 *
 * Прежний ключ — привычка и дата — допускал одну отметку на привычку в день.
 * Для личной привычки это незаметно, а в общей второй участник просто не смог
 * бы отметиться: его запись считалась бы повторной.
 *
 * Ключ таблицы в SQLite не меняется на месте, поэтому таблица пересоздаётся,
 * а данные переливаются. Проверка перед этим обязательна: без неё перезапуск
 * сервера каждый раз гонял бы все отметки туда-обратно.
 */
/*
 * Подбор за прерванным переездом.
 *
 * Между удалением старой таблицы и переименованием новой есть миг, когда
 * отметки лежат только под временным именем. Обрыв здесь однажды уже стоил
 * данных: следующий запуск создавал пустую таблицу и считал дело сделанным.
 * Теперь остатки временной таблицы возвращаются на место, а сам переезд идёт
 * одной транзакцией и оборваться посередине не может.
 */
const leftovers = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entries_new'",
)
if (leftovers.rows.length > 0) {
  await db.batch(
    [
      {
        sql: `INSERT OR IGNORE INTO entries (user_id, habit_id, date)
                SELECT user_id, habit_id, date FROM entries_new
                 WHERE habit_id IN (SELECT id FROM habits)`,
        args: [],
      },
      { sql: 'DROP TABLE entries_new', args: [] },
    ],
    'write',
  )
}

const entriesInfo = await db.execute('PRAGMA table_info(entries)')
const entriesKey = entriesInfo.rows.filter((row) => row.pk > 0).map((row) => row.name)

if (entriesKey.length > 0 && !entriesKey.includes('user_id')) {
  await db.batch(
    [
      {
        sql: `CREATE TABLE entries_new (
                user_id  INTEGER NOT NULL,
                habit_id TEXT    NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
                date     TEXT    NOT NULL,
                PRIMARY KEY (habit_id, user_id, date)
              )`,
        args: [],
      },
      { sql: 'INSERT INTO entries_new (user_id, habit_id, date) SELECT user_id, habit_id, date FROM entries', args: [] },
      { sql: 'DROP TABLE entries', args: [] },
      { sql: 'ALTER TABLE entries_new RENAME TO entries', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_entries_user ON entries (user_id, date)', args: [] },
    ],
    'write',
  )
}

/*
 * Каждая уже заведённая привычка получает своего создателя участником.
 * Без этого после перехода на участников старые привычки пропали бы из
 * списка у их же хозяев — в новой картине мира они ничьи.
 */
await db.execute(`
  INSERT OR IGNORE INTO habit_members (habit_id, user_id, sort_order, joined_at)
    SELECT id, user_id, sort_order, created_at FROM habits
`)

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

  -- Кто с кем в общих привычках: сразу видно, прижилась ли совместность.
  DROP VIEW IF EXISTS view_members;
  CREATE VIEW view_members AS
    SELECT m.user_id, u.first_name, u.username,
           h.name AS habit_name,
           CASE WHEN h.user_id = m.user_id THEN 'создатель' ELSE 'участник' END AS role,
           (SELECT COUNT(*) FROM habit_members x WHERE x.habit_id = m.habit_id) AS members_total,
           m.joined_at, m.habit_id
      FROM habit_members m
      JOIN habits h ON h.id = m.habit_id
      LEFT JOIN users u ON u.user_id = m.user_id
     ORDER BY m.habit_id, m.joined_at;

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
