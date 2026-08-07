import { db } from '../db.js'
import { visitSchema } from '../schemas.js'

/**
 * Учёт заходов в приложение.
 *
 * На каждого человека — одна строка, а не запись о каждом открытии: журнал
 * всех заходов рос бы бесконечно, а ответы даёт те же самые. Из строки видно
 * сколько всего людей, кто заходил недавно и — главное — кто возвращался
 * повторно (`opens` больше единицы).
 *
 * Имя, ник и язык берём из подписанных данных Telegram, чтобы владелец бота
 * узнавал своих пользователей и мог их найти. Ник в Telegram необязателен —
 * у кого его нет, столбец остаётся пустым, и опознать человека можно только
 * по имени.
 */
export async function userRoutes(app) {
  app.post('/api/visit', { schema: visitSchema }, async (request) => {
    const now = new Date().toISOString()
    const user = request.telegramUser ?? {}

    // Часовой пояс приходит от приложения: в данных Telegram его нет, а без
    // него неизвестно, когда у человека вечер.
    const tzOffset = Number(request.body?.tzOffset)

    await db.execute({
      sql: `INSERT INTO users (user_id, first_name, username, language, first_seen, last_seen, opens, tz_offset, photo_url)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
              first_name = excluded.first_name,
              username   = excluded.username,
              language   = excluded.language,
              last_seen  = excluded.last_seen,
              opens      = users.opens + 1,
              -- Прежние значения сохраняем, если приложение не прислало новых:
              -- старая версия на телефоне не должна стирать уже известное.
              tz_offset  = COALESCE(excluded.tz_offset, users.tz_offset),
              photo_url  = COALESCE(excluded.photo_url, users.photo_url)`,
      args: [
        request.userId,
        user.first_name ?? '',
        user.username ?? null,
        user.language_code ?? null,
        now,
        now,
        Number.isFinite(tzOffset) ? tzOffset : null,
        user.photo_url ?? null,
      ],
    })

    return { ok: true }
  })
}
