import { db } from '../db.js'

/**
 * Учёт заходов в приложение.
 *
 * На каждого человека — одна строка, а не запись о каждом открытии: журнал
 * всех заходов рос бы бесконечно, а ответы даёт те же самые. Из строки видно
 * сколько всего людей, кто заходил недавно и — главное — кто возвращался
 * повторно (`opens` больше единицы).
 *
 * Имя и язык берём из подписанных данных Telegram, чтобы владелец бота узнавал
 * своих пользователей. Больше ничего не храним: для ответа на вопрос
 * «сколько людей и возвращаются ли они» этого достаточно.
 */
export async function userRoutes(app) {
  app.post('/api/visit', async (request) => {
    const now = new Date().toISOString()
    const user = request.telegramUser ?? {}

    await db.execute({
      sql: `INSERT INTO users (user_id, first_name, language, first_seen, last_seen, opens)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT (user_id) DO UPDATE SET
              first_name = excluded.first_name,
              language   = excluded.language,
              last_seen  = excluded.last_seen,
              opens      = users.opens + 1`,
      args: [request.userId, user.first_name ?? '', user.language_code ?? null, now, now],
    })

    return { ok: true }
  })
}
