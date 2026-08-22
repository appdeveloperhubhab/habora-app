import { useEffect } from 'react'
import type { Habit } from '../../../types'
import { useStore } from '../../../store/context'
import { useNav } from '../../../shell/navigation'
import { dict } from '../../../i18n'
import { Icon } from '../../../ui/Icon'
import { Avatar } from '../../../ui/Avatar'
import { shareLink } from '../../../lib/telegram'
import { currentStreak } from '../../../lib/streak'
import { formatDuration } from '../../../lib/timer'
import { ActivityGrid } from './ActivityGrid'
import { MetricCards } from './MetricCards'
import { MonthCalendar } from './MonthCalendar'
import { TimelineChart } from './TimelineChart'
import styles from './HabitScreen.module.css'

/**
 * Экран привычки — вся её аналитика на одной прокручиваемой странице.
 *
 * Блоки идут от быстрого взгляда к деталям: сначала сетка активности и
 * ключевые цифры, затем календарь с точными датами, затем графики динамики.
 * Отдельного окна «Аналитика» нет намеренно: прятать графики за ещё одним
 * нажатием незачем, тап по привычке должен сразу показывать всё.
 */
export function HabitScreen({
  habit,
  onBack,
  onEdit,
  onOpenTimer,
}: {
  habit: Habit
  onBack(): void
  onEdit(): void
  onOpenTimer(): void
}) {
  const { settings, datesOf, toggleEntry, inviteLink, friends, refreshFriends } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)
  const dates = datesOf(habit.id)

  /*
   * Отметки друзей ставятся на их телефонах и сами собой не приходят —
   * спрашиваем заново при открытии привычки. Без этого, если человек зашёл
   * сюда, ни разу не открыв вкладку друзей, список был бы пуст, и совместная
   * привычка выглядела бы одиночной.
   */
  useEffect(() => {
    void refreshFriends()
  }, [refreshFriends])

  const invite = async () => {
    const url = await inviteLink(habit.id)
    if (!url) return
    shareLink(url, t.actions.inviteText.replace('{habit}', habit.name))
  }

  const members = habit.members ?? []

  /** Кто ведёт эту же привычку вместе с вами — с их отметками по ней. */
  const sharedWith = friends
    .map((friend) => ({ friend, shared: friend.habits.find((item) => item.habitId === habit.id) }))
    .filter((entry): entry is { friend: (typeof friends)[number]; shared: { habitId: string; dates: string[] } } =>
      entry.shared !== undefined,
    )

  return (
    <div className={styles.screen} style={{ '--habit': habit.color } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.iconButton} onClick={onBack} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>

        <div className={styles.heading}>
          <h2 className={styles.title}>{habit.name}</h2>
          {habit.description && <p className={styles.description}>{habit.description}</p>}
        </div>

        <button className={`${styles.iconButton} ${styles.edit}`} onClick={onEdit} aria-label={t.common.edit}>
          <Icon name="pencil" size={20} />
        </button>
      </header>

      <div className={styles.content}>
        {/*
          Участники и приглашение — сразу под шапкой, до всей аналитики:
          совместность привычки это первое, что о ней стоит знать, а звать
          друга удобнее оттуда, где на привычку и смотришь.

          Каждый участник — строка, ведущая на общую сетку с ним. Раньше здесь
          лежали неподвижные аватарки: было видно, что привычка совместная, но
          посмотреть, как у друга идут дела, можно было только через вкладку
          «Друзья» — то есть выйдя из привычки, о которой и шла речь.
        */}
        {sharedWith.length > 0 && (
          <div className={styles.friends}>
            {sharedWith.map(({ friend, shared }) => {
              const streak = currentStreak(shared.dates, habit.schedule)
              return (
                <button
                  key={friend.userId}
                  className={styles.friendRow}
                  onClick={() =>
                    nav.push({ name: 'sharedHabit', habitId: habit.id, friendUserId: friend.userId })
                  }
                >
                  <Avatar name={friend.firstName} photoUrl={friend.photoUrl} size={34} />
                  <span className={styles.friendText}>
                    <span className={styles.friendName}>{friend.firstName}</span>
                    <span className={styles.friendNote}>
                      {streak.value > 0
                        ? `${streak.value} ${streak.unit === 'weeks' ? t.common.weeks : t.common.days} ${t.common.inARow}`
                        : t.friends.noStreak}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              )
            })}
          </div>
        )}

        <button className={styles.inviteButton} onClick={() => void invite()}>
          <Icon name="friends" size={17} />
          {members.length > 1 ? t.friends.invite : t.actions.invite}
        </button>

        {/*
          Назначенный час — единственное место, где его видно, не открывая
          редактор. Участнику совместной привычки редактор и вовсе недоступен:
          правит привычку только создатель, а напоминание приходит обоим.
        */}
        {habit.remindAt && (
          <div className={styles.remind}>
            <div className={styles.remindRow}>
              <Icon name="bell" size={17} />
              {t.detail.remindAt}
              <span className={styles.remindTime}>{habit.remindAt}</span>
            </div>

            {/* Выключенные напоминания гасят и этот час: обещать письмо,
                которое не придёт, хуже, чем не обещать ничего. */}
            {!settings.reminders && <p className={styles.remindOff}>{t.detail.remindersOff}</p>}
          </div>
        )}

        {/* Таймер живёт здесь, а не на карточке в списке: там он мешал
            полоскам недели и был лишним для большинства привычек. */}
        {habit.durationSec !== null && (
          <button className={styles.timerButton} onClick={onOpenTimer}>
            <Icon name="play" size={18} />
            {t.timer.start}
            <span className={styles.timerDuration}>
              {formatDuration(habit.durationSec, t.timer.minutes, t.timer.seconds)}
            </span>
          </button>
        )}

        {/*
          Календарь идёт первым. Он единственный отвечает на вопрос «а этот
          день я отметил?» и единственный, где отметку можно поставить задним
          числом, — то есть с ним работают, а остальное разглядывают. Сводки
          и графики встают следом, от короткого взгляда к деталям.
        */}
        <MonthCalendar
          dates={dates}
          color={habit.color}
          lang={settings.lang}
          onToggleDay={(date) => void toggleEntry(habit.id, date)}
        />
        <ActivityGrid dates={dates} color={habit.color} lang={settings.lang} />
        <MetricCards habit={habit} dates={dates} lang={settings.lang} t={t} />
        <TimelineChart dates={dates} color={habit.color} lang={settings.lang} t={t} />
      </div>
    </div>
  )
}
