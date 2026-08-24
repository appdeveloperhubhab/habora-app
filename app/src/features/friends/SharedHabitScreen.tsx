import { useEffect, useRef } from 'react'
import type { Friend, Habit, Lang } from '../../types'
import type { Dict } from '../../i18n'
import { activityGrid } from '../../lib/stats'
import { currentStreak, longestStreak } from '../../lib/streak'
import { todayIso, weekdayShort } from '../../lib/dates'
import { plural } from '../../lib/plural'
import { personColor } from '../../lib/personColor'
import { currentUserId } from '../../lib/telegram'
import { Icon } from '../../ui/Icon'
import { Avatar } from '../../ui/Avatar'
import { CheckButton } from '../habits/CheckButton'
import styles from './SharedHabitScreen.module.css'

/**
 * Общая привычка вдвоём: одна сетка на двоих вместо своей и чужой по
 * отдельности, чтобы совпадение или несовпадение дней читалось с одного
 * взгляда, а не сравнением двух картинок.
 *
 * Экран открывается по тапу на привычку внутри карточки друга. Дальше — вся
 * та же приватность, что и на вкладке «Друзья»: видно только то, что и так
 * было на карточке, только крупнее и с историей за год.
 */

const WEEKS_SHOWN = 53

interface Props {
  habit: Habit
  friend: Friend
  myDates: string[]
  friendDates: string[]
  /** Сколько раз выполнено сегодня — у привычки с нормой на день. */
  count?: number
  lang: Lang
  t: Dict
  onBack(): void
  onToggle(): void
}

export function SharedHabitScreen({
  habit,
  friend,
  myDates,
  friendDates,
  count = 0,
  lang,
  t,
  onBack,
  onToggle,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)

  const mine = activityGrid(myDates, WEEKS_SHOWN)
  const theirs = activityGrid(friendDates, WEEKS_SHOWN)

  // Прокручиваем к текущей неделе, как и в собственной сетке активности:
  // интересна она, а не начало истории.
  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [])

  const doneToday = myDates.includes(todayIso())
  const friendColor = personColor(friend.firstName)

  // Своё имя и фото — из списка участников привычки, а не из «Вы»-подписи:
  // на этом экране, в отличие от остальных, себя тоже видно и хочется узнать
  // своё же лицо, а не первую букву местоимения.
  const me = currentUserId()
  const myName = habit.members?.find((member) => member.userId === me)?.firstName ?? t.friends.you
  const myPhoto = habit.members?.find((member) => member.userId === me)?.photoUrl ?? null

  const myStreak = currentStreak(myDates, habit.schedule)
  const myLongest = longestStreak(myDates, habit.schedule)
  const friendStreak = currentStreak(friendDates, habit.schedule)
  const friendLongest = longestStreak(friendDates, habit.schedule)

  const unit = (streak: { value: number; unit: 'days' | 'weeks' }) =>
    streak.unit === 'weeks'
      ? plural(streak.value, lang, [t.detail.weekOne, t.detail.weekFew, t.detail.weekMany])
      : plural(streak.value, lang, [t.detail.dayOne, t.detail.dayFew, t.detail.dayMany])

  return (
    <div className={styles.screen} style={{ '--habit': habit.color, '--friend': friendColor } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.iconButton} onClick={onBack} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>

        <div className={styles.heading}>
          <h2 className={styles.title}>{habit.name}</h2>
          <span className={styles.subtitle}>
            {t.friends.you} · {friend.firstName}
          </span>
        </div>

        <span className={styles.avatars}>
          <Avatar name={myName} photoUrl={myPhoto} size={32} />
          <Avatar name={friend.firstName} photoUrl={friend.photoUrl} size={32} />
        </span>
      </header>

      <div className={styles.content}>
        {/* Своя отметка — единственное действие на экране, поэтому она стоит
            первой, до всей истории. */}
        <div className={styles.todayRow}>
          <span className={styles.todayLabel}>{done(doneToday, t)}</span>
          <CheckButton
            done={doneToday}
            color={habit.color}
            count={count}
            target={habit.target}
            size={48}
            onToggle={onToggle}
          />
        </div>

        <section className={styles.grid}>
          <h3 className={styles.gridTitle}>{t.friends.activityTogether}</h3>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: habit.color }} />
              {t.friends.you}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: friendColor }} />
              {friend.firstName}
            </span>
          </div>

          <div className={styles.row}>
            <div className={styles.labels}>
              {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
                <span key={day} className={styles.dayLabel}>
                  {weekdayShort(day, lang)}
                </span>
              ))}
            </div>

            <div className={styles.scroller} ref={scroller}>
              <div className={styles.cells}>
                {mine.map((week, weekIndex) => (
                  <div key={week[0].date} className={styles.week}>
                    {week.map((cell, dayIndex) => {
                      const friendCell = theirs[weekIndex][dayIndex]
                      const both = cell.done && friendCell.done
                      return (
                        <span
                          key={cell.date}
                          className={[styles.cell, both ? styles.both : '', cell.isToday ? styles.today : '', cell.isFuture ? styles.future : '']
                            .filter(Boolean)
                            .join(' ')}
                          style={{
                            background: `linear-gradient(135deg, ${cell.done ? 'var(--habit)' : 'var(--cell-empty)'} 50%, ${
                              friendCell.done ? 'var(--friend)' : 'var(--cell-empty)'
                            } 50%)`,
                          }}
                          title={both ? `${cell.date} — ${t.friends.bothDone}` : cell.date}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.streaks}>
          <div className={styles.streakCard}>
            <span className={styles.streakName}>{t.friends.you}</span>
            <p className={styles.streakValue}>
              <span className={styles.streakNumber}>{myStreak.value}</span>
              <span className={styles.streakUnit}>{unit(myStreak)}</span>
            </p>
            <p className={styles.streakFootnote}>
              {t.detail.longest}: <strong>{myLongest.value}</strong>
            </p>
          </div>

          <div className={`${styles.streakCard} ${styles.streakCardFriend}`}>
            <span className={styles.streakName}>{friend.firstName}</span>
            <p className={styles.streakValue}>
              <span className={styles.streakNumber}>{friendStreak.value}</span>
              <span className={styles.streakUnit}>{unit(friendStreak)}</span>
            </p>
            <p className={styles.streakFootnote}>
              {t.detail.longest}: <strong>{friendLongest.value}</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function done(doneToday: boolean, t: Dict): string {
  return doneToday ? t.habits.marked : t.habits.mark
}
