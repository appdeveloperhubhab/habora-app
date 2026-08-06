import { useEffect } from 'react'
import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { todayIso } from '../../lib/dates'
import { currentStreak, weekProgress } from '../../lib/streak'
import { HabitIcon } from '../../ui/habitIcons'
import { Icon } from '../../ui/Icon'
import { EmptyState } from '../../ui/EmptyState'
import { Avatar } from '../../ui/Avatar'
import styles from './FriendsScreen.module.css'

/**
 * Друзья — люди, с которыми есть общие привычки.
 *
 * Не лента событий: с двумя-тремя друзьями лента почти всегда пуста и
 * выглядит сломанной. Список людей с их сегодняшним состоянием читается
 * живым, даже когда друг один.
 *
 * Отдельного списка друзей нет и заводить его не нужно: человек попадает
 * сюда, потому что вы с ним в одной привычке.
 */
export function FriendsScreen({
  onInvite,
  onCreateHabit,
}: {
  onInvite(): void
  /** Звать некуда, пока нет ни одной привычки, — ведём заводить первую. */
  onCreateHabit(): void
}) {
  const { friends, habits, settings, refreshFriends } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)
  const today = todayIso()

  // Отметки друзей ставятся на их телефонах — узнать о них можно только
  // спросив заново, каждый раз при открытии вкладки.
  useEffect(() => {
    void refreshFriends()
  }, [refreshFriends])

  if (friends.length === 0) {
    /*
     * Пригласить можно только в привычку — значит, у кого её ещё нет, зовём
     * сначала завести. Кнопка «пригласить» без единой привычки вела бы в
     * пустоту, и человек упёрся бы в неё, не поняв почему.
     */
    return habits.length === 0 ? (
      <EmptyState
        title={t.friends.empty}
        hint={t.friends.emptyNoHabits}
        actionLabel={t.friends.createFirst}
        actionIcon="plus"
        onAction={onCreateHabit}
      />
    ) : (
      <EmptyState
        title={t.friends.empty}
        hint={t.friends.emptyHint}
        actionLabel={t.friends.invite}
        actionIcon="friends"
        onAction={onInvite}
      />
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.list}>
        {friends.map((friend) => (
          <article key={friend.userId} className={styles.card}>
            <header className={styles.head}>
              <Avatar name={friend.firstName} photoUrl={friend.photoUrl} size={44} />
              <span className={styles.who}>
                <span className={styles.name}>{friend.firstName}</span>
                {friend.username && <span className={styles.username}>@{friend.username}</span>}
              </span>
            </header>

            <div className={styles.habits}>
              {friend.habits.map((shared) => {
                const habit = habits.find((item) => item.id === shared.habitId)
                if (!habit) return null

                const doneToday = shared.dates.includes(today)
                const streak = currentStreak(shared.dates, habit.schedule, today)
                const week = weekProgress(shared.dates, today)

                return (
                  <button
                    key={shared.habitId}
                    className={styles.habit}
                    style={{ '--habit': habit.color } as React.CSSProperties}
                    // Открывает общую сетку на двоих — конкретную привычку, а не
                    // всю карточку человека: у него их может быть несколько.
                    onClick={() =>
                      nav.push({ name: 'sharedHabit', habitId: habit.id, friendUserId: friend.userId })
                    }
                  >
                    <span className={styles.habitIcon}>
                      <HabitIcon icon={habit.icon} size={17} />
                    </span>

                    <span className={styles.habitBody}>
                      <span className={styles.habitName}>{habit.name}</span>
                      <span className={styles.habitNote}>
                        {/* Серия — та же цифра и по тому же расчёту, что человек
                            видит у себя: другой ответ на тот же вопрос сбивал бы. */}
                        {streak.value > 0
                          ? `${streak.value} ${streak.unit === 'weeks' ? t.common.weeks : t.common.days} ${t.common.inARow}`
                          : t.friends.noStreak}
                      </span>
                    </span>

                    {/* Неделя точками: видно не только сегодня, но и как шло дело. */}
                    <span className={styles.week}>
                      {week.map((day) => (
                        <span
                          key={day.date}
                          className={[
                            styles.dot,
                            day.done ? styles.dotDone : '',
                            day.isToday ? styles.dotToday : '',
                            day.isFuture ? styles.dotFuture : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        />
                      ))}
                    </span>

                    <span className={doneToday ? `${styles.mark} ${styles.markDone}` : styles.mark} />
                  </button>
                )
              })}
            </div>
          </article>
        ))}
      </div>

      {/* Позвать ещё одного — не прячем в меню: это главное действие раздела,
          и оно должно быть на виду, а не находиться наощупь. */}
      <button className={styles.invite} onClick={onInvite}>
        <Icon name="friends" size={18} />
        {t.friends.invite}
      </button>
    </div>
  )
}
