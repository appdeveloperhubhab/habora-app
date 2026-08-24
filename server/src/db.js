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
    -- Время напоминания ЧЧ:ММ по местному времени участников; NULL — не напоминать.
    remind_at    TEXT,
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
    -- Дата последнего напоминания по времени привычки, по местному времени
    -- участника. Своя у каждого: будильник стучится часто, и без отметки одно
    -- и то же напоминание уходило бы каждые несколько минут до полуночи.
    reminded_on TEXT,
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

  /*
   * Кому и о чьей отметке уже сообщали.
   *
   * Отметка снимается и ставится обратно одним касанием — случайно задели,
   * вернули. Без этой таблицы напарник получал бы весть о каждом таком
   * касании, и первое же дрогнувшее нажатие превращалось бы в очередь
   * одинаковых сообщений.
   *
   * Строка на привычку, отметившегося и день: ключ сам отсекает повтор, а
   * записывается она до отправки — так две отметки, пришедшие в один миг из
   * приложения и из кнопки в чате, не разойдутся двумя сообщениями.
   */
  CREATE TABLE IF NOT EXISTS mark_notices (
    habit_id TEXT    NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL,
    date     TEXT    NOT NULL,
    PRIMARY KEY (habit_id, actor_id, date)
  );

  /*
   * Задачи. Раздел убран из приложения — им не пользовались, а место в нижней
   * навигации нужнее друзьям. Таблица и данные оставлены нетронутыми: удалять
   * чужие записи заодно с кодом нельзя, вернуть их будет неоткуда.
   */
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
    reminded_on  TEXT,
    blocked      INTEGER NOT NULL DEFAULT 0
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

/**
 * Закрыт ли человеку доступ. Ноль у всех, кроме тех, кого закрыли вручную:
 * блокировка — редкое решение владельца бота, а не что-то, что случается само.
 */
await addColumnIfMissing('users', 'blocked', 'INTEGER NOT NULL DEFAULT 0')

/*
 * Столбцы для напоминания в назначенный час.
 *
 * `habit_members.remind_at` — время `ЧЧ:ММ`, своё у каждого участника.
 * Сначала оно стояло у привычки, одно на всех: казалось, что в совместной
 * привычке договариваются делать вместе, а значит и напоминать надо разом.
 * Это оказалось неверно. Договорённость — это дни и само дело; в котором часу
 * кому напомнить, к ней отношения не имеет. Один идёт с утра, другой после
 * работы, и общий час одному из них делал напоминание бесполезным.
 *
 * `habits.remind_at` остаётся в таблице, но больше не читается: он нужен
 * только как источник для переезда ниже.
 *
 * `habit_members.reminded_on` — дата последней отправки, у каждого участника
 * своя: они живут в разных часовых поясах, и «сегодня» у них наступает
 * в разные моменты.
 */
await addColumnIfMissing('habits', 'remind_at', 'TEXT')
await addColumnIfMissing('habit_members', 'reminded_on', 'TEXT')
await addColumnIfMissing('habit_members', 'remind_at', 'TEXT')

/*
 * Переезд времени с привычки на её участников.
 *
 * Раздаём всем нынешним участникам, а не одному создателю: до этой правки
 * напоминание в назначенный час получал каждый, и оставить его одному хозяину
 * значило бы молча лишить остальных того, что им уже приходило. Новые
 * приглашённые начинают с выключенного — но это про будущее, а не про тех,
 * кто уже внутри.
 *
 * Источник после переезда очищается, и в этом всё дело: «пусто» у участника
 * означает «выключено», и по одному лишь пустому полю отличить не тронутую
 * запись от намеренно выключенной нельзя. Останься время у привычки — первый
 * же перезапуск сервера возвращал бы выключенное обратно.
 *
 * Обе части идут одной транзакцией: обрыв между ними либо раздал бы время
 * дважды, либо потерял бы его совсем.
 */
const кПереезду = await db.execute(
  "SELECT COUNT(*) AS n FROM habits WHERE remind_at IS NOT NULL AND remind_at <> ''",
)
if (Number(кПереезду.rows[0].n) > 0) {
  await db.batch(
    [
      {
        sql: `UPDATE habit_members
                 SET remind_at = (SELECT h.remind_at FROM habits h WHERE h.id = habit_members.habit_id)
               WHERE EXISTS (
                 SELECT 1 FROM habits h
                  WHERE h.id = habit_members.habit_id AND h.remind_at IS NOT NULL AND h.remind_at <> ''
               )`,
        args: [],
      },
      { sql: 'UPDATE habits SET remind_at = NULL', args: [] },
    ],
    'write',
  )
}

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
           h.streak_goal, h.tinted, h.duration_sec, h.remind_at, h.sort_order, h.created_at, h.id
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
 * Как долго список заблокированных живёт в памяти, не перечитываясь.
 *
 * Спрашивать базу на каждый запрос — лишний поход в облако ради ответа,
 * который меняется раз в год. Плата за память — блокировка вступает в силу
 * в течение минуты, а не мгновенно; для решения, принимаемого руками, это
 * никакой роли не играет.
 */
const BLOCKED_TTL_MS = 60_000

let blocked = { readAt: 0, ids: new Set() }

/**
 * Закрыт ли человеку доступ.
 *
 * Telegram запретить кому-то писать боту не умеет — бан есть только у групп и
 * каналов. Значит, отказывать приходится самому серверу, и делает он это по
 * номеру Telegram: тот приходит подписанным ключом бота, и подделать его,
 * не зная токена, нельзя.
 *
 * Сорвавшийся запрос к базе никого не блокирует: когда база молчит, не
 * работает и всё остальное, и запирать в этот момент вообще всех — значит
 * превращать заминку в облаке в отказ приложения.
 */
export async function isBlocked(userId) {
  if (Date.now() - blocked.readAt > BLOCKED_TTL_MS) {
    try {
      const { rows } = await db.execute('SELECT user_id FROM users WHERE blocked = 1')
      blocked = { readAt: Date.now(), ids: new Set(rows.map((row) => Number(row.user_id))) }
    } catch {
      // Оставляем прежний список и не долбим базу до следующего срока.
      blocked = { ...blocked, readAt: Date.now() }
    }
  }
  return blocked.ids.has(Number(userId))
}

/**
 * Забыть запомненный список.
 *
 * Нужен там, где блокировку только что поставили сами — из команд бота:
 * решение принято здесь и сейчас, и ждать, пока список перечитается сам,
 * незачем.
 */
export function forgetBlocked() {
  blocked = { readAt: 0, ids: blocked.ids }
}

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
    remindAt: row.remind_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

