import { db } from './db.js'

/**
 * Отметки за день — единственное место, где они меняются.
 *
 * Отдельным модулем, а не в маршруте, потому что отмечают из двух мест:
 * из приложения и кнопкой под сообщением бота. Разойдись эти два пути — и
 * норма считалась бы по-разному в зависимости от того, откуда нажали.
 */

/** Сколько раз в день привычку нужно выполнить; по умолчанию — один. */
export async function targetOf(habitId) {
  const { rows } = await db.execute({
    sql: 'SELECT target FROM habits WHERE id = ?',
    args: [habitId],
  })
  return Math.max(1, Number(rows[0]?.target ?? 1))
}

/** Сколько раз выполнено в этот день. */
export async function countOf(habitId, userId, date) {
  const { rows } = await db.execute({
    sql: 'SELECT count FROM entries WHERE habit_id = ? AND user_id = ? AND date = ?',
    args: [habitId, userId, date],
  })
  return Number(rows[0]?.count ?? 0)
}

/** Каким станет счётчик после действия. */
function applied(action, before, target) {
  if (action === 'full') return target
  if (action === 'clear') return 0
  if (action === 'dec') return Math.max(0, before - 1)
  return Math.min(target, before + 1)
}

/**
 * Изменить отметку.
 *
 * Возвращает не только новое число, но и `completed` — стал ли день закрытым
 * именно сейчас. По нему решают, звать ли салют и слать ли весть напарникам:
 * без него у привычки с нормой в три раза они срабатывали бы трижды за день.
 */
export async function markEntry(habitId, userId, date, action = 'inc') {
  const target = await targetOf(habitId)
  const before = await countOf(habitId, userId, date)
  const after = applied(action, before, target)

  if (after === before) {
    return { count: after, done: after >= target, completed: false, target }
  }

  if (after === 0) {
    await db.execute({
      sql: 'DELETE FROM entries WHERE habit_id = ? AND user_id = ? AND date = ?',
      args: [habitId, userId, date],
    })
  } else {
    await db.execute({
      sql: `INSERT INTO entries (user_id, habit_id, date, count) VALUES (?, ?, ?, ?)
            ON CONFLICT (habit_id, user_id, date) DO UPDATE SET count = excluded.count`,
      args: [userId, habitId, date, after],
    })
  }

  return {
    count: after,
    done: after >= target,
    completed: after >= target && before < target,
    target,
  }
}
