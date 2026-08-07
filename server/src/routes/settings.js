import { db } from '../db.js'
import { DEFAULT_SETTINGS } from '../defaults.js'
import { settingsSchema } from '../schemas.js'

/** Настройки приложения — одна запись на человека, целиком в JSON. */
export async function settingsRoutes(app) {
  app.get('/api/settings', async (request) => {
    const { rows } = await db.execute({
      sql: 'SELECT data FROM settings WHERE user_id = ?',
      args: [request.userId],
    })
    // Раскладываем поверх значений по умолчанию: новая настройка в свежей
    // версии приложения не сломает уже сохранённые записи.
    return { ...DEFAULT_SETTINGS, ...(rows[0] ? JSON.parse(rows[0].data) : {}) }
  })

  app.patch('/api/settings', { schema: settingsSchema }, async (request) => {
    const { rows } = await db.execute({
      sql: 'SELECT data FROM settings WHERE user_id = ?',
      args: [request.userId],
    })
    const merged = { ...DEFAULT_SETTINGS, ...(rows[0] ? JSON.parse(rows[0].data) : {}), ...(request.body ?? {}) }

    await db.execute({
      sql: `INSERT INTO settings (user_id, data) VALUES (?, ?)
            ON CONFLICT (user_id) DO UPDATE SET data = excluded.data`,
      args: [request.userId, JSON.stringify(merged)],
    })

    return merged
  })
}
