import { randomUUID } from 'node:crypto'
import { db, rowToHabit } from '../db.js'
import { botUsername } from '../telegram/api.js'
import { notifyHabitDeleted, notifyPartnersMarked } from '../telegram/partners.js'
import {
  createHabitSchema,
  entriesQuerySchema,
  habitsQuerySchema,
  reminderSchema,
  reorderSchema,
  toggleEntrySchema,
  updateHabitSchema,
} from '../schemas.js'

/**
 * Привычки, участники и отметки выполнения.
 *
 * Привычка принадлежит не одному человеку, а списку участников: обычная — это
 * просто список из одного.
 *
 * Право читать и удалять даёт участие, право менять — создательство. Правка
 * оставлена одному, потому что двое переименовывали бы одно и то же по
 * очереди; удаление отдано всем, потому что общая привычка либо нужна обоим,
 * либо не нужна вовсе.
 *
 * Отметки у каждого свои. Это и есть смысл совместной привычки: пропуск одного
 * не стирает отметку другому, а видно каждому обоих.
 */

/** Участник ли человек в привычке. */
async function isMember(habitId, userId) {
  const { rows } = await db.execute({
    sql: 'SELECT 1 FROM habit_members WHERE habit_id = ? AND user_id = ?',
    args: [habitId, userId],
  })
  return rows.length > 0
}

/** Собственное время напоминания человека по этой привычке; null — выключено. */
async function ownReminder(habitId, userId) {
  const { rows } = await db.execute({
    sql: 'SELECT remind_at FROM habit_members WHERE habit_id = ? AND user_id = ?',
    args: [habitId, userId],
  })
  return rows[0]?.remind_at ?? null
}

/**
 * Ставит человеку его собственное время напоминания по этой привычке.
 *
 * Отметка о сегодняшней отправке снимается вместе со временем — и только у
 * него одного. Без этого переставивший час с девяти на шесть не дождался бы
 * напоминания сегодня: сервер считал бы, что ему уже отправлено. У остальных
 * участников свой час и своя отметка, трогать их незачем.
 */
async function setOwnReminder(habitId, userId, remindAt) {
  await db.execute({
    sql: `UPDATE habit_members
             SET remind_at = ?, reminded_on = NULL
           WHERE habit_id = ? AND user_id = ?`,
    args: [remindAt, habitId, userId],
  })
}

/** Привычка, если человек её создал. Иначе null — менять её он не вправе. */
async function ownHabit(habitId, userId) {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM habits WHERE id = ? AND user_id = ?',
    args: [habitId, userId],
  })
  return rows[0] ?? null
}

/**
 * Участники привычек одним запросом на весь список.
 *
 * Отдельным запросом на каждую привычку список из десяти карточек стоил бы
 * десяти обращений к облачной базе — по сети это заметно.
 */
async function membersOf(habitIds, date) {
  if (habitIds.length === 0) return new Map()

  const placeholders = habitIds.map(() => '?').join(',')
  const { rows } = await db.execute({
    sql: `SELECT m.habit_id, m.user_id, m.joined_at, u.first_name, u.username, u.photo_url,
                 h.user_id AS owner_id,
                 CASE WHEN e.habit_id IS NULL THEN 0 ELSE 1 END AS done_today
            FROM habit_members m
            JOIN habits h ON h.id = m.habit_id
            LEFT JOIN users u ON u.user_id = m.user_id
            LEFT JOIN entries e
                   ON e.habit_id = m.habit_id AND e.user_id = m.user_id AND e.date = ?
           WHERE m.habit_id IN (${placeholders})
           ORDER BY m.joined_at`,
    args: [date ?? '', ...habitIds],
  })

  const byHabit = new Map()
  for (const row of rows) {
    const list = byHabit.get(row.habit_id) ?? []
    list.push({
      userId: Number(row.user_id),
      firstName: row.first_name ?? '',
      username: row.username,
      photoUrl: row.photo_url,
      joinedAt: row.joined_at,
      isOwner: Number(row.owner_id) === Number(row.user_id),
      doneToday: row.done_today === 1,
    })
    byHabit.set(row.habit_id, list)
  }
  return byHabit
}

export async function habitRoutes(app) {
  app.get('/api/habits', { schema: habitsQuerySchema }, async (request) => {
    /*
     * Порядок и время напоминания берутся из участия, а не из привычки:
     * и то и другое у каждого своё.
     *
     * Имена столбцов разведены намеренно. В таблице привычки есть свои
     * `sort_order` и `remind_at`, и `h.*` притаскивает их сюда же; при
     * совпадении имён побеждает первый, то есть столбец привычки, а личное
     * значение молча теряется. Порядку это сходило с рук — он берётся из
     * `ORDER BY`, — а вот время напоминания приходило бы пустым всегда.
     */
    const { rows } = await db.execute({
      sql: `SELECT h.*, m.sort_order AS my_sort_order, m.remind_at AS my_remind_at
              FROM habits h
              JOIN habit_members m ON m.habit_id = h.id
             WHERE m.user_id = ?
             ORDER BY m.sort_order, h.created_at`,
      args: [request.userId],
    })

    const date = String(request.query?.today ?? '')
    const members = await membersOf(rows.map((row) => row.id), date)

    return rows.map((row) => ({
      ...rowToHabit(row),
      sortOrder: row.my_sort_order,
      remindAt: row.my_remind_at,
      ownerId: Number(row.user_id),
      members: members.get(row.id) ?? [],
    }))
  })

  app.post('/api/habits', { schema: createHabitSchema }, async (request) => {
    const input = request.body

    // Новая привычка встаёт в конец списка — того, который видит сам создатель.
    const { rows } = await db.execute({
      sql: 'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM habit_members WHERE user_id = ?',
      args: [request.userId],
    })
    const next = rows[0].next

    const habit = {
      id: randomUUID(),
      name: input.name.trim(),
      description: input.description ?? '',
      color: input.color,
      icon: input.icon,
      schedule: input.schedule,
      streakGoal: input.streakGoal ?? null,
      tinted: input.tinted ?? true,
      durationSec: input.durationSec ?? null,
      remindAt: input.remindAt ?? null,
      sortOrder: next,
      createdAt: new Date().toISOString(),
    }

    await db.batch(
      [
        {
          sql: `INSERT INTO habits (id, user_id, name, description, color, icon, schedule,
                                    streak_goal, tinted, duration_sec, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            habit.id,
            request.userId,
            habit.name,
            habit.description,
            habit.color,
            habit.icon,
            JSON.stringify(habit.schedule),
            habit.streakGoal,
            habit.tinted ? 1 : 0,
            habit.durationSec,
            habit.sortOrder,
            habit.createdAt,
          ],
        },
        /*
         * Создатель — первый участник. Обе записи одной транзакцией: привычка
         * без участников не видна вообще никому, включая её автора.
         *
         * Время напоминания ложится сюда, а не в привычку: оно личное. У
         * заводящего оно берётся из формы, у тех, кого позовут позже, начнётся
         * с выключенного — своё время каждый назначает сам.
         */
        {
          sql: `INSERT INTO habit_members (habit_id, user_id, sort_order, joined_at, remind_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [habit.id, request.userId, habit.sortOrder, habit.createdAt, habit.remindAt],
        },
      ],
      'write',
    )

    return { ...habit, ownerId: request.userId, members: [] }
  })

  app.patch('/api/habits/:id', { schema: updateHabitSchema }, async (request, reply) => {
    // Менять привычку вправе только тот, кто её завёл: остальные её выполняют.
    const existing = await ownHabit(request.params.id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'Привычка не найдена' })

    const merged = { ...rowToHabit(existing), ...(request.body ?? {}) }

    await db.execute({
      sql: `UPDATE habits
              SET name = ?, description = ?, color = ?, icon = ?, schedule = ?,
                  streak_goal = ?, tinted = ?, duration_sec = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        merged.name,
        merged.description,
        merged.color,
        merged.icon,
        JSON.stringify(merged.schedule),
        merged.streakGoal,
        merged.tinted ? 1 : 0,
        merged.durationSec,
        request.params.id,
        request.userId,
      ],
    })

    /*
     * Время напоминания приходит сюда же, из той же формы, но живёт не в
     * привычке, а в участии — и меняется только своё. Создатель, правя
     * привычку, переставляет час себе, а не всем: у остальных он свой.
     */
    if (request.body && 'remindAt' in request.body) {
      await setOwnReminder(request.params.id, request.userId, request.body.remindAt ?? null)
    }

    /*
     * Час в ответе — свой, а не из привычки.
     *
     * `merged` собран из строки привычки, а там столбец времени остался
     * пустым после переезда. Верни мы его как есть — приложение приняло бы
     * пустоту за выключенное напоминание и погасило бы у себя только что
     * назначенный час.
     */
    return { ...merged, remindAt: await ownReminder(request.params.id, request.userId) }
  })

  /**
   * Время напоминания — своё у каждого участника.
   *
   * Отдельный маршрут, а не поле в правке привычки: править привычку вправе
   * один создатель, а назначать себе час — каждый, кто в ней состоит. Иначе
   * приглашённый не смог бы включить напоминание вовсе.
   */
  app.patch('/api/habits/:id/reminder', { schema: reminderSchema }, async (request, reply) => {
    if (!(await isMember(request.params.id, request.userId))) {
      return reply.code(404).send({ error: 'Привычка не найдена' })
    }

    const remindAt = request.body?.remindAt ?? null
    await setOwnReminder(request.params.id, request.userId, remindAt)
    return { remindAt }
  })

  /**
   * Удаление привычки — у всех участников сразу, кто бы её ни удалил.
   *
   * Раньше право стереть привычку у всех было только у создателя, а участник
   * своим «удалить» лишь выходил из неё. Получалось, что у двоих на одну и ту
   * же кнопку два разных исхода, и который из них твой — зависело от того,
   * кто первым завёл привычку месяц назад.
   *
   * Теперь исход один: общая привычка исчезает у обоих вместе со всей
   * историей отметок. Взамен об этом предупреждают дважды — в самом
   * приложении перед удалением и сообщением бота остальным после него: чужие
   * отметки пропадают не молча, и человек знает, что случилось и по чьей
   * воле.
   *
   * Участников, отметки и служебные записи о вестях уносит каскадом за самой
   * привычкой — внешние ключи в базе включены, это проверено.
   */
  app.delete('/api/habits/:id', async (request, reply) => {
    const habitId = request.params.id

    /*
     * Всё нужное собираем до удаления: после него ни привычки, ни списка
     * участников уже нет, и сообщать будет некому и не о чем.
     */
    const { rows } = await db.execute({
      sql: `SELECT m.user_id, u.language, u.chat_started, s.data AS settings,
                   h.name AS habit_name
              FROM habit_members m
              JOIN habits h ON h.id = m.habit_id
              LEFT JOIN users u ON u.user_id = m.user_id
              LEFT JOIN settings s ON s.user_id = m.user_id
             WHERE m.habit_id = ?`,
      args: [habitId],
    })

    // Удалять вправе участник, и только он: идентификатор привычки уходит в
    // ссылке-приглашении, и посторонний с ней не должен стирать чужое.
    const me = rows.find((row) => Number(row.user_id) === Number(request.userId))
    if (!me) return reply.code(404).send({ error: 'Привычка не найдена' })

    await db.execute({ sql: 'DELETE FROM habits WHERE id = ?', args: [habitId] })

    /*
     * Весть остальным — вдогонку ответу: удаление уже состоялось, и держать
     * из-за неё интерфейс незачем. Не дошла — привычка всё равно удалена.
     */
    const others = rows.filter((row) => Number(row.user_id) !== Number(request.userId))
    if (others.length > 0) {
      void notifyHabitDeleted(others, rows[0].habit_name, request.telegramUser?.first_name).catch(
        (error) => app.log.error({ error, habitId }, 'не удалось известить об удалении'),
      )
    }

    return { ok: true, deleted: true }
  })

  /**
   * Ссылка-приглашение в привычку.
   *
   * Ведёт в чат с ботом, а не сразу в приложение: прямая ссылка работает
   * только при включённом «главном мини-приложении», а эта — всегда. Заодно
   * приглашённый нажимает «Старт», без чего Telegram не даст слать ему
   * напоминания.
   *
   * Опознаётся привычка своим же идентификатором: он случайный и не
   * угадывается, а отдельный код приглашения пришлось бы где-то хранить,
   * отзывать и чистить — ради того же результата.
   */
  app.get('/api/habits/:id/invite', async (request, reply) => {
    if (!(await isMember(request.params.id, request.userId))) {
      return reply.code(404).send({ error: 'Привычка не найдена' })
    }

    const username = await botUsername()
    if (!username) return reply.code(503).send({ error: 'Бот недоступен' })

    return { url: `https://t.me/${username}?start=join_${request.params.id}` }
  })

  /** Присоединиться к привычке по приглашению. */
  app.post('/api/habits/:id/join', async (request, reply) => {
    const { rows } = await db.execute({
      sql: 'SELECT id, name FROM habits WHERE id = ?',
      args: [request.params.id],
    })
    if (!rows[0]) return reply.code(404).send({ error: 'Привычка не найдена' })

    const { rows: order } = await db.execute({
      sql: 'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM habit_members WHERE user_id = ?',
      args: [request.userId],
    })

    await db.execute({
      sql: `INSERT OR IGNORE INTO habit_members (habit_id, user_id, sort_order, joined_at)
            VALUES (?, ?, ?, ?)`,
      args: [request.params.id, request.userId, order[0].next, new Date().toISOString()],
    })

    return { ok: true, habitId: request.params.id, name: rows[0].name }
  })

  app.post('/api/habits/reorder', { schema: reorderSchema }, async (request) => {
    const ids = request.body.ids

    // Весь новый порядок применяется одной транзакцией: иначе сбой на середине
    // оставил бы список наполовину переставленным.
    await db.batch(
      ids.map((id, index) => ({
        sql: 'UPDATE habit_members SET sort_order = ? WHERE habit_id = ? AND user_id = ?',
        args: [index, id, request.userId],
      })),
      'write',
    )

    const { rows } = await db.execute({
      sql: `SELECT h.*, m.sort_order AS sort_order
              FROM habits h
              JOIN habit_members m ON m.habit_id = h.id
             WHERE m.user_id = ?
             ORDER BY m.sort_order, h.created_at`,
      args: [request.userId],
    })
    return rows.map(rowToHabit)
  })

  app.get('/api/entries', { schema: entriesQuerySchema }, async (request) => {
    const { from, to } = request.query ?? {}

    const { rows } =
      from && to
        ? await db.execute({
            sql: 'SELECT habit_id, date FROM entries WHERE user_id = ? AND date BETWEEN ? AND ?',
            args: [request.userId, from, to],
          })
        : await db.execute({
            sql: 'SELECT habit_id, date FROM entries WHERE user_id = ?',
            args: [request.userId],
          })

    return rows.map((row) => ({ habitId: row.habit_id, date: row.date }))
  })

  app.post('/api/entries/toggle', { schema: toggleEntrySchema }, async (request, reply) => {
    const { habitId, date } = request.body

    // Отмечать вправе любой участник, а не только создатель.
    if (!(await isMember(habitId, request.userId))) {
      return reply.code(404).send({ error: 'Привычка не найдена' })
    }

    const existing = await db.execute({
      sql: 'SELECT 1 FROM entries WHERE habit_id = ? AND user_id = ? AND date = ?',
      args: [habitId, request.userId, date],
    })

    if (existing.rows[0]) {
      await db.execute({
        sql: 'DELETE FROM entries WHERE habit_id = ? AND user_id = ? AND date = ?',
        args: [habitId, request.userId, date],
      })
      return { done: false }
    }

    await db.execute({
      sql: 'INSERT INTO entries (user_id, habit_id, date) VALUES (?, ?, ?)',
      args: [request.userId, habitId, date],
    })

    /*
     * Напарникам — весть, но не дожидаясь её отправки: галочка в приложении
     * должна отзываться мгновенно, а поход в Telegram занимает сотни
     * миллисекунд на каждого участника. Не дошло — не беда, отметка уже
     * записана, и ради неё сюда и обращались.
     */
    void notifyPartnersMarked(habitId, request.userId, date).catch((error) => {
      app.log.error({ error, habitId }, 'не удалось известить напарников')
    })

    return { done: true }
  })
}
