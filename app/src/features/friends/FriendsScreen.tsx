import { useEffect } from 'react'
import type { Habit } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { HabitList } from '../habits/HabitList'
import { Icon } from '../../ui/Icon'
import { EmptyState } from '../../ui/EmptyState'
import { Avatar } from '../../ui/Avatar'
import styles from './FriendsScreen.module.css'

/**
 * Друзья — люди, с которыми есть общие привычки.
 *
 * Не лента событий: с двумя-тремя друзьями лента почти всегда пуста и
 * выглядит сломанной. Список людей с их общими привычками читается живым,
 * даже когда друг один.
 *
 * Привычки под каждым человеком — те же карточки, что и на главном экране,
 * с тем же поведением: тап открывает всю аналитику привычки, долгое нажатие
 * — меню, галочка отмечает за сегодня. Отличие одно: показаны только общие
 * с этим человеком привычки, и день в них поделён на двоих — ваш цвет и его.
 *
 * Раньше здесь была своя укороченная строка с чужой неделей, и одна и та же
 * привычка выглядела в двух местах двумя разными вещами: на главном экране
 * карточкой, у друга — строкой, ведущей не туда, куда ведёт карточка.
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
  const t = dict(settings.lang)

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
      {/* Позвать ещё одного — сразу под заголовком: это главное действие
          раздела, и искать его в конце длинного списка не должно быть нужно.
          Тихой строкой, не заливкой: людей и их привычки оно перебивать не
          должно — за ним приходят, когда уже решили позвать. */}
      <button className={styles.invite} onClick={onInvite}>
        <Icon name="friends" size={16} />
        {t.friends.invite}
      </button>

      <div className={styles.list}>
        {friends.map((friend) => {
          /*
           * Общие с этим человеком привычки — свои же, взятые по списку от
           * сервера. Берём именно свои: у карточки должны быть свои отметки,
           * свой цвет и своё расписание, а у друга по общей привычке приходят
           * только даты.
           */
          const shared = friend.habits
            .map(({ habitId }) => habits.find((item) => item.id === habitId))
            .filter((habit): habit is Habit => habit !== undefined)

          if (shared.length === 0) return null

          return (
            <section key={friend.userId} className={styles.friend}>
              <header className={styles.head}>
                <Avatar name={friend.firstName} photoUrl={friend.photoUrl} size={40} />
                <span className={styles.who}>
                  <span className={styles.name}>{friend.firstName}</span>
                  {friend.username && <span className={styles.username}>@{friend.username}</span>}
                </span>
              </header>

              <HabitList habits={shared} partnerId={friend.userId} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
