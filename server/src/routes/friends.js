import { db } from '../db.js'

/**
 * Друзья — люди, с которыми есть общие привычки.
 *
 * Отдельного списка друзей нет намеренно. Он потянул бы за собой заявки,
 * принятие, удаление из друзей и блокировку — целый мир правил ради того же
 * результата. Здесь связь возникает от участия в привычке и исчезает вместе
 * с ним: вышел — и связи нет.
 *
 * Показываем только то, что касается общих привычек. Остальные привычки
 * человека, его задачи и настройки сюда не попадают ни при каком запросе:
 * делятся привычкой, а не аккаунтом.
 */
export async function friendRoutes(app) {
  app.get('/api/friends', async (request) => {
    // Участники моих привычек, кроме меня самого.
    const { rows: members } = await db.execute({
      sql: `SELECT m.user_id, m.habit_id, u.first_name, u.username, u.photo_url
              FROM habit_members m
              JOIN habit_members mine
                ON mine.habit_id = m.habit_id AND mine.user_id = ?
              LEFT JOIN users u ON u.user_id = m.user_id
             WHERE m.user_id != ?`,
      args: [request.userId, request.userId],
    })

    if (members.length === 0) return []

    /*
     * Отметки друзей — только по привычкам, где я тоже участник. Условие по
     * моему участию стоит в самом запросе, а не в разборе ответа: так чужая
     * история физически не может попасть в выдачу даже по ошибке в коде выше.
     *
     * Серии считает приложение своим же кодом, что и для собственных привычек:
     * повторять этот расчёт на сервере — значит завести вторую правду о том,
     * что такое серия.
     */
    const { rows: entries } = await db.execute({
      sql: `SELECT e.user_id, e.habit_id, e.date
              FROM entries e
              JOIN habit_members mine
                ON mine.habit_id = e.habit_id AND mine.user_id = ?
             WHERE e.user_id != ?
             ORDER BY e.date`,
      args: [request.userId, request.userId],
    })

    const byFriend = new Map()

    for (const row of members) {
      const id = Number(row.user_id)
      const friend = byFriend.get(id) ?? {
        userId: id,
        firstName: row.first_name ?? '',
        username: row.username,
        photoUrl: row.photo_url,
        habits: new Map(),
      }
      friend.habits.set(row.habit_id, [])
      byFriend.set(id, friend)
    }

    for (const row of entries) {
      const friend = byFriend.get(Number(row.user_id))
      const dates = friend?.habits.get(row.habit_id)
      if (dates) dates.push(row.date)
    }

    return [...byFriend.values()].map((friend) => ({
      userId: friend.userId,
      firstName: friend.firstName,
      username: friend.username,
      photoUrl: friend.photoUrl,
      habits: [...friend.habits.entries()].map(([habitId, dates]) => ({ habitId, dates })),
    }))
  })
}
