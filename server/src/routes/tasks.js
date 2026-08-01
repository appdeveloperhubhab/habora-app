import { randomUUID } from 'node:crypto'
import { db, rowToTask } from '../db.js'
import { DEFAULT_SETTINGS } from '../defaults.js'

/** Задачи и настройки. Как и привычки, всегда в пределах своего user_id. */
export async function taskRoutes(app) {
  app.get('/api/tasks', async (request) => {
    return db
      .prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY date, time')
      .all(request.userId)
      .map(rowToTask)
  })

  app.post('/api/tasks', async (request, reply) => {
    const input = request.body ?? {}
    if (!input.title?.trim()) return reply.code(400).send({ error: 'Название обязательно' })

    const task = {
      id: randomUUID(),
      title: input.title.trim(),
      date: input.date,
      time: input.time ?? null,
      priority: input.priority ?? 'normal',
      durationSec: input.durationSec ?? null,
      doneAt: null,
      createdAt: new Date().toISOString(),
    }

    db.prepare(
      `INSERT INTO tasks (id, user_id, title, date, time, priority, duration_sec, done_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      task.id,
      request.userId,
      task.title,
      task.date,
      task.time,
      task.priority,
      task.durationSec,
      task.doneAt,
      task.createdAt,
    )

    return task
  })

  app.patch('/api/tasks/:id', async (request, reply) => {
    const existing = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'Задача не найдена' })

    const merged = { ...rowToTask(existing), ...(request.body ?? {}) }

    db.prepare(
      `UPDATE tasks SET title = ?, date = ?, time = ?, priority = ?, duration_sec = ?
        WHERE id = ? AND user_id = ?`,
    ).run(
      merged.title,
      merged.date,
      merged.time,
      merged.priority,
      merged.durationSec,
      request.params.id,
      request.userId,
    )

    return merged
  })

  app.delete('/api/tasks/:id', async (request) => {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(request.params.id, request.userId)
    return { ok: true }
  })

  app.post('/api/tasks/:id/toggle', async (request, reply) => {
    const existing = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'Задача не найдена' })

    const doneAt = existing.done_at ? null : new Date().toISOString()
    db.prepare('UPDATE tasks SET done_at = ? WHERE id = ? AND user_id = ?').run(
      doneAt,
      request.params.id,
      request.userId,
    )

    return { ...rowToTask(existing), doneAt }
  })

  app.get('/api/settings', async (request) => {
    const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(request.userId)
    // Раскладываем поверх значений по умолчанию: новая настройка в свежей
    // версии приложения не сломает уже сохранённые записи.
    return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.data) : {}) }
  })

  app.patch('/api/settings', async (request) => {
    const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(request.userId)
    const merged = { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.data) : {}), ...(request.body ?? {}) }

    db.prepare(
      `INSERT INTO settings (user_id, data) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET data = excluded.data`,
    ).run(request.userId, JSON.stringify(merged))

    return merged
  })
}
