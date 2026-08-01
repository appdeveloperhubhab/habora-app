import { randomUUID } from 'node:crypto'
import { db, rowToHabit } from '../db.js'

/**
 * Привычки и отметки выполнения.
 *
 * Каждый запрос работает только со строками текущего пользователя: `user_id`
 * приходит из проверенной подписи Telegram и подставляется в условие всегда,
 * даже когда клиент прислал чужой id в теле запроса.
 */
export async function habitRoutes(app) {
  app.get('/api/habits', async (request) => {
    const rows = db
      .prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order, created_at')
      .all(request.userId)
    return rows.map(rowToHabit)
  })

  app.post('/api/habits', async (request, reply) => {
    const input = request.body ?? {}
    if (!input.name?.trim()) return reply.code(400).send({ error: 'Название обязательно' })

    // Новая привычка встаёт в конец списка.
    const { next } = db
      .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM habits WHERE user_id = ?')
      .get(request.userId)

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

    db.prepare(
      `INSERT INTO habits (id, user_id, name, description, color, icon, schedule,
                           streak_goal, tinted, duration_sec, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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
    )

    return habit
  })

  app.patch('/api/habits/:id', async (request, reply) => {
    const existing = db
      .prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'Привычка не найдена' })

    const patch = request.body ?? {}
    const merged = { ...rowToHabit(existing), ...patch }

    db.prepare(
      `UPDATE habits
          SET name = ?, description = ?, color = ?, icon = ?, schedule = ?,
              streak_goal = ?, tinted = ?, duration_sec = ?
        WHERE id = ? AND user_id = ?`,
    ).run(
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
    )

    return merged
  })

  app.delete('/api/habits/:id', async (request) => {
    // Отметки удаляются каскадом — так их не остаётся висеть в базе без привычки.
    db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(request.params.id, request.userId)
    return { ok: true }
  })

  app.post('/api/habits/reorder', async (request) => {
    const ids = request.body?.ids ?? []
    const update = db.prepare('UPDATE habits SET sort_order = ? WHERE id = ? AND user_id = ?')

    // Весь новый порядок применяется одной транзакцией: иначе сбой на середине
    // оставил бы список наполовину переставленным.
    db.exec('BEGIN')
    try {
      ids.forEach((id, index) => update.run(index, id, request.userId))
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    return db
      .prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order, created_at')
      .all(request.userId)
      .map(rowToHabit)
  })

  app.get('/api/entries', async (request) => {
    const { from, to } = request.query ?? {}

    const rows =
      from && to
        ? db
            .prepare('SELECT habit_id, date FROM entries WHERE user_id = ? AND date BETWEEN ? AND ?')
            .all(request.userId, from, to)
        : db.prepare('SELECT habit_id, date FROM entries WHERE user_id = ?').all(request.userId)

    return rows.map((row) => ({ habitId: row.habit_id, date: row.date }))
  })

  app.post('/api/entries/toggle', async (request, reply) => {
    const { habitId, date } = request.body ?? {}
    if (!habitId || !date) return reply.code(400).send({ error: 'Нужны habitId и date' })

    // Проверяем принадлежность привычки: иначе можно было бы отметить чужую.
    const habit = db
      .prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?')
      .get(habitId, request.userId)
    if (!habit) return reply.code(404).send({ error: 'Привычка не найдена' })

    const existing = db
      .prepare('SELECT 1 FROM entries WHERE habit_id = ? AND date = ?')
      .get(habitId, date)

    if (existing) {
      db.prepare('DELETE FROM entries WHERE habit_id = ? AND date = ?').run(habitId, date)
      return { done: false }
    }

    db.prepare('INSERT INTO entries (user_id, habit_id, date) VALUES (?, ?, ?)').run(
      request.userId,
      habitId,
      date,
    )
    return { done: true }
  })
}
