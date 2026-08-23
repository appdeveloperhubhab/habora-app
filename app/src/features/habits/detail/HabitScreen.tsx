import { useEffect } from 'react'
import type { Habit } from '../../../types'
import { useStore } from '../../../store/context'
import { useNav } from '../../../shell/navigation'
import { dict } from '../../../i18n'
import { Icon } from '../../../ui/Icon'
import { Avatar } from '../../../ui/Avatar'
import { TimePicker } from '../../../ui/TimePicker'
import { canEdit } from '../canEdit'
import { currentUserId, shareLink } from '../../../lib/telegram'
import { currentStreak } from '../../../lib/streak'
import { personColor } from '../../../lib/personColor'
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
  const { settings, datesOf, toggleEntry, inviteLink, friends, refreshFriends, setReminder } =
    useStore()
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
  const shared = members.length > 1

  /**
   * С какого дня человек ведёт эту привычку.
   *
   * Запасное значение — день заведения самой привычки: у привычек, ведомых
   * без сервера, участников нет вовсе, и спросить дату вступления не у кого.
   */
  const sinceOf = (userId: number | null) =>
    members.find((m) => m.userId === userId)?.joinedAt ?? habit.createdAt

  const mySince = sinceOf(currentUserId())


  /** Кто ведёт эту же привычку вместе с вами — с их отметками по ней. */
  const sharedWith = friends
    .map((friend) => ({ friend, shared: friend.habits.find((item) => item.habitId === habit.id) }))
    .filter((entry): entry is { friend: (typeof friends)[number]; shared: { habitId: string; dates: string[] } } =>
      entry.shared !== undefined,
    )

  /*
   * Участники для плашек: сам человек первым, дальше напарники. Порядок
   * важен — в каждой плашке числа идут в нём же, и своё должно стоять слева,
   * там, где его и ищут.
   *
   * Свой цвет — цвет привычки: это её экран, и красить себя чем-то третьим
   * значило бы завести на нём ещё один цвет без нужды.
   */
  const people = [
    { key: 'me', name: t.friends.you, dates, since: mySince, color: habit.color },
    ...sharedWith.map(({ friend, shared: theirs }) => ({
      key: String(friend.userId),
      name: friend.firstName,
      dates: theirs.dates,
      since: sinceOf(friend.userId),
      color: personColor(friend.firstName),
    })),
  ]

  /*
   * Те же участники, но с отметками готовым набором: календарь спрашивает про
   * каждый день каждого, и перебирать список дат на каждую клетку — это под
   * две сотни проходов на один показанный месяц.
   */
  const calendarPeople = people.map((человек) => ({
    key: человек.key,
    color: человек.color,
    marks: new Set(человек.dates),
  }))

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

        {/* Карандаш — только у создателя. Приглашённому он открывал форму,
            которая ничего не сохраняла: правка чужой привычки запрещена на
            сервере, и галочка просто не срабатывала. */}
        {canEdit(habit) ? (
          <button className={`${styles.iconButton} ${styles.edit}`} onClick={onEdit} aria-label={t.common.edit}>
            <Icon name="pencil" size={20} />
          </button>
        ) : (
          /* Пустое место вместо кнопки: шапка — сетка из трёх ячеек, и без
             третьей название съехало бы с середины к правому краю. Именно
             пустое: с фоном кнопки оно читалось бы как сломанная кнопка. */
          <span className={styles.barSpacer} aria-hidden="true" />
        )}
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
          Напоминание — своё у каждого участника, и настраивается оно здесь.
          Не в редакторе: редактор открывает только создатель, а час нужен
          каждому. Приглашённый входит с выключенным и назначает себе сам, ни
          на кого не влияя.
        */}
        <section className={styles.remind}>
          <h3 className={styles.remindTitle}>{t.editor.remind}</h3>
          <TimePicker
            value={habit.remindAt}
            color={habit.color}
            labels={{ on: t.editor.remindOn, off: t.editor.remindOff }}
            onChange={(next) => void setReminder(habit.id, next)}
          />

          {/* Выключенные в настройках напоминания гасят и этот час: обещать
              письмо, которое не придёт, хуже, чем не обещать ничего. */}
          {habit.remindAt && !settings.reminders && (
            <p className={styles.remindOff}>{t.detail.remindersOff}</p>
          )}
        </section>

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
          Порядок — от итога к подробностям.

          Цифры первыми: четыре числа отвечают «как дела» целиком, и ради
          этого ответа сюда чаще всего и заходят. Календарь следом — он
          единственный, где отметку можно поставить задним числом, то есть с
          ним работают. Дальше хронология и сетка года: их разглядывают, и
          ждать своей очереди они могут.
        */}
        {/*
          Цифры всех участников — в одних и тех же четырёх плашках, парами.
          Сначала было по набору на человека, но восемь плашек вместо четырёх
          вытесняли календарь за нижний край, а сравнивать числа приходилось,
          переводя взгляд между блоками. Рядом это делается само.

          Кто где — видно по цвету: своё число цветом привычки, напарника —
          его собственным, тем же, каким он покрашен во вкладке «Друзья».
          Подпись с именами нужна только когда людей больше одного.
        */}
        {shared && (
          <div className={styles.whose}>
            {people.map((человек) => (
              <span key={человек.key} className={styles.whoseItem}>
                <span className={styles.whoseDot} style={{ background: человек.color }} />
                {человек.name}
              </span>
            ))}
          </div>
        )}
        <MetricCards habit={habit} people={people} lang={settings.lang} t={t} />

        <MonthCalendar
          dates={dates}
          people={calendarPeople}
          color={habit.color}
          lang={settings.lang}
          onToggleDay={(date) => void toggleEntry(habit.id, date)}
        />
        <TimelineChart dates={dates} color={habit.color} lang={settings.lang} t={t} />
        <ActivityGrid dates={dates} color={habit.color} lang={settings.lang} />
      </div>
    </div>
  )
}
