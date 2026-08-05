import { randomUUID } from 'node:crypto'
import { db, rowToHabit } from '../db.js'
import { botUsername } from '../telegram/api.js'

/**
 * Привычки, участники и отметки выполнения.
 *
 * Привычка принадлежит не одному человеку, а списку участников: обычная — это
 * просто список из одного. Право читать даёт участие, право менять и удалять —
 * создательство: иначе двое правили бы одно и то же, а вышедший забирал бы
 * привычку у остальных.
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
    sql: `SELECT m.habit_id, m.user_id, u.first_name, u.username, u.photo_url,
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
      isOwner: Number(row.owner_id) === Number(row.user_id),
      doneToday: row.done_today === 1,
    })
    byHabit.set(row.habit_id, list)
  }
  return byHabit
}

export async function habitRoutes(app) {
  app.get('/api/habits', async (request) => {
    // Порядок берётся из участия, а не из привычки: у каждого он свой.
    const { rows } = await db.execute({
      sql: `SELECT h.*, m.sort_order AS sort_order
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
      ownerId: Number(row.user_id),
      members: members.get(row.id) ?? [],
    }))
  })

  app.post('/api/habits', async (request, reply) => {
    const input = request.body ?? {}
    if (!input.name?.trim()) return reply.code(400).send({ error: 'Название обязательно' })

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
        // Создатель — первый участник. Обе записи одной транзакцией: привычка
        // без участников не видна вообще никому, включая её автора.
        {
          sql: 'INSERT INTO habit_members (habit_id, user_id, sort_order, joined_at) VALUES (?, ?, ?, ?)',
          args: [habit.id, request.userId, habit.sortOrder, habit.createdAt],
        },
      ],
      'write',
    )

    return { ...habit, ownerId: request.userId, members: [] }
  })

  app.patch('/api/habits/:id', async (request, reply) => {
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

    return merged
  })

  /**
   * Удаление у создателя убирает привычку у всех, у остальных — только выход.
   * Иначе присоединившийся, нажав «удалить», стирал бы чужую историю.
   */
  app.delete('/api/habits/:id', async (request) => {
    const own = await ownHabit(request.params.id, request.userId)

    if (own) {
      await db.execute({ sql: 'DELETE FROM habits WHERE id = ?', args: [request.params.id] })
      return { ok: true, deleted: true }
    }

    await db.batch(
      [
        {
          sql: 'DELETE FROM habit_members WHERE habit_id = ? AND user_id = ?',
          args: [request.params.id, request.userId],
        },
        // Свои отметки уходят вместе с участием: вернувшись, человек начинает
        // с чистого листа, а у остальных его следов не остаётся.
        {
          sql: 'DELETE FROM entries WHERE habit_id = ? AND user_id = ?',
          args: [request.params.id, request.userId],
        },
      ],
      'write',
    )
    return { ok: true, deleted: false }
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

  app.post('/api/habits/reorder', async (request) => {
    const ids = request.body?.ids ?? []

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

  app.get('/api/entries', async (request) => {
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

  app.post('/api/entries/toggle', async (request, reply) => {
    const { habitId, date } = request.body ?? {}
    if (!habitId || !date) return reply.code(400).send({ error: 'Нужны habitId и date' })

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
    return { done: true }
  })
}
