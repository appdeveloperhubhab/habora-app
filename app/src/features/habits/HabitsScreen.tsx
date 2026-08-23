import { useEffect } from 'react'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { EmptyState } from '../../ui/EmptyState'
import { HabitList } from './HabitList'
import styles from './HabitsScreen.module.css'

/**
 * Список привычек — главный экран приложения.
 *
 * Сами карточки со всем их поведением живут в `HabitList`: тот же список
 * показан и под каждым другом на вкладке «Друзья», и расходиться они не
 * должны. Здесь остаётся только то, что есть лишь у главного экрана: пустое
 * состояние и подсказка новичку.
 */
export function HabitsScreen({ orderMode = false }: { orderMode?: boolean }) {
  const { habits, settings, refreshFriends } = useStore()
  const t = dict(settings.lang)

  /*
   * Отметки друзей ставятся на их телефонах и сами собой не приходят. Раньше
   * их спрашивали только на вкладке «Друзья» и внутри привычки — а теперь они
   * нужны и здесь, на первом же экране: без них совместные дни красились бы
   * одним цветом до тех пор, пока человек не сходит к друзьям и обратно.
   */
  useEffect(() => {
    void refreshFriends()
  }, [refreshFriends])

  if (habits.length === 0) {
    return <EmptyState title={t.habits.empty} hint={t.habits.emptyHint} />
  }

  // Единственное действие, которое стоит объяснить новичку. Подсказка живёт
  // до первой отметки — не по таймеру и не по числу показов.
  const showHint = !settings.hintSeen && !orderMode

  return (
    <>
      {showHint && <p className={styles.hint}>{t.onboarding.hint}</p>}
      <HabitList habits={habits} orderMode={orderMode} hint={showHint} padded />
    </>
  )
}
