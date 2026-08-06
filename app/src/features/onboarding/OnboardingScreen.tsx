import { useRef, useState } from 'react'
import type { Habit, Weekday } from '../../types'
import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { hapticSelect, hapticSuccess, hapticWarning } from '../../lib/haptics'
import { shareLink } from '../../lib/telegram'
import { Icon } from '../../ui/Icon'
import { HabitIcon } from '../../ui/habitIcons'
import { STARTER_HABITS } from './starterHabits'
import styles from './OnboardingScreen.module.css'

/**
 * Первый запуск: приветствие, выбор готовых привычек и приглашение друга.
 *
 * Раньше человек, открывший приложение впервые, видел пустой список и надпись
 * «Пока нет ни одной привычки» — по этому кадру невозможно понять ни что это
 * за приложение, ни с чего начать.
 *
 * Каждый шаг можно пройти насквозь, ничего не выбрав: навязывать чужие привычки
 * тому, кто пришёл со своими, — худшее первое впечатление. Для таких людей
 * внизу есть отдельный вход в редактор.
 *
 * Приглашение стоит последним и только когда привычки заведены: звать друга
 * некуда, пока нет ни одной, — ссылка ведёт в конкретную привычку. Спрашиваем
 * здесь, а не оставляем на потом, потому что вдвоём привычка держится лучше,
 * чем в одиночку, и предложить это стоит в тот момент, когда человек только
 * решил её завести.
 */

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export function OnboardingScreen() {
  const { settings, createHabit, saveSettings, inviteLink } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)

  const [step, setStep] = useState<'welcome' | 'pick' | 'invite'>('welcome')
  const [picked, setPicked] = useState<string[]>([])
  const [created, setCreated] = useState<Habit[]>([])
  const [saving, setSaving] = useState(false)

  /*
   * Защита от повторного нажатия держится на ref, а не на состоянии:
   * `setSaving` применяется только к следующему рендеру, поэтому два быстрых
   * тапа подряд успевали пройти проверку оба и создавали привычки дважды.
   */
  const finishing = useRef(false)

  const toggle = (id: string) => {
    hapticSelect()
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /** Закрывает приветствие: дальше человек попадает на главный экран. */
  const done = async () => {
    await saveSettings({ onboarded: true })
  }

  const finish = async (thenCreateOwn = false) => {
    if (finishing.current) return
    finishing.current = true
    setSaving(true)

    // Создаём последовательно, а не через Promise.all: порядок в списке
    // должен совпасть с порядком выбора, а не с тем, кто быстрее записался.
    const habits: Habit[] = []
    for (const id of picked) {
      const starter = STARTER_HABITS.find((item) => item.id === id)
      if (!starter) continue
      habits.push(
        await createHabit({
          name: starter.name[settings.lang],
          description: '',
          icon: starter.icon,
          color: starter.color,
          tinted: true,
          schedule: { type: 'weekdays', days: EVERY_DAY, timesPerWeek: 7 },
          streakGoal: null,
          durationSec: null,
        }),
      )
    }

    if (habits.length > 0) hapticSuccess()

    /*
     * Шаг с приглашением пропускаем в двух случаях. Если не выбрано ни одной
     * привычки — звать некуда: ссылка ведёт в конкретную привычку. Если человек
     * идёт заводить свою — он уже нажал на другое действие, и вставать у него
     * на пути с третьим вопросом значит не услышать ответ на второй; позвать
     * друга он сможет прямо в редакторе, куда сейчас и попадёт.
     */
    if (thenCreateOwn || habits.length === 0) {
      await done()
      if (thenCreateOwn) nav.push({ name: 'habitEditor', habitId: null })
      return
    }

    setCreated(habits)
    setStep('invite')
    // Замок снимаем: он защищал от двойного создания привычек, а на следующем
    // шаге кнопки снова должны нажиматься.
    finishing.current = false
    setSaving(false)
  }

  /** Позвать друга в конкретную привычку и закрыть приветствие. */
  const invite = async (habit: Habit) => {
    if (finishing.current) return
    finishing.current = true
    setSaving(true)

    const url = await inviteLink(habit.id)
    // Ссылки нет, когда приложение открыто без сервера. Приветствие всё равно
    // закрываем: держать человека на шаге, который не может сработать, хуже,
    // чем пустить его в приложение.
    if (url) shareLink(url, t.actions.inviteText.replace('{habit}', habit.name))
    else hapticWarning()

    await done()
  }

  if (step === 'welcome') {
    return (
      <div className={styles.screen}>
        <div className={styles.glow} />

        <div className={styles.welcome}>
          <span className={styles.logo}>
            <Icon name="habits" size={40} strokeWidth={2} />
          </span>
          <h1 className={styles.appName}>Habora</h1>
          <p className={styles.tagline}>{t.onboarding.tagline}</p>

          {/*
            Три строки вместо прежнего абзаца. Абзац читался целиком или никак,
            и совместные привычки — то, ради чего приложение и затевалось, —
            оставались в нём последним придаточным. Списком видно с одного
            взгляда, что здесь делают, а «вместе с друзьями» стоит отдельным
            пунктом наравне с остальными, а не примечанием к ним.
          */}
          <ul className={styles.points}>
            {(
              [
                ['check', t.onboarding.pointMark],
                ['viewTable', t.onboarding.pointYear],
                ['friends', t.onboarding.pointFriends],
              ] as const
            ).map(([icon, text]) => (
              <li key={icon} className={styles.point}>
                <span className={styles.pointIcon}>
                  <Icon name={icon} size={18} strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <button
          className={styles.primary}
          onClick={() => {
            hapticSelect()
            setStep('pick')
          }}
        >
          {t.onboarding.start}
        </button>
      </div>
    )
  }

  if (step === 'invite') {
    return (
      <div className={styles.screen}>
        <div className={styles.glow} />

        <header className={styles.pickHeader}>
          <h1 className={styles.pickTitle}>{t.onboarding.inviteTitle}</h1>
          <p className={styles.pickHint}>{t.onboarding.inviteHint}</p>
        </header>

        {/*
          Привычку выбирают тапом по ней же, а не отдельной кнопкой «дальше»:
          приглашение всегда ведёт в конкретную привычку, и лишний экран
          «в какую именно» только удлинил бы дорогу к тому же результату.
        */}
        <div className={styles.chips}>
          {created.map((habit) => (
            <button
              key={habit.id}
              className={styles.chip}
              style={{ '--habit': habit.color } as React.CSSProperties}
              onClick={() => void invite(habit)}
              disabled={saving}
            >
              <span className={styles.chipIcon}>
                <HabitIcon icon={habit.icon} size={22} />
              </span>
              <span className={styles.chipName}>{habit.name}</span>
              <span className={styles.chipMark}>
                <Icon name="friends" size={14} />
              </span>
            </button>
          ))}
        </div>

        {/* Отказ — обычной кнопкой, а не мелкой ссылкой: «потом» здесь такой
            же законный ответ, как и «позвать», и прятать его незачем. */}
        <button className={styles.secondary} onClick={() => void done()} disabled={saving}>
          {t.onboarding.inviteLater}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.glow} />

      <header className={styles.pickHeader}>
        <h1 className={styles.pickTitle}>{t.onboarding.pickTitle}</h1>
        <p className={styles.pickHint}>{t.onboarding.pickHint}</p>
      </header>

      <div className={styles.chips}>
        {STARTER_HABITS.map((habit) => {
          const active = picked.includes(habit.id)
          return (
            <button
              key={habit.id}
              className={active ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              style={{ '--habit': habit.color } as React.CSSProperties}
              onClick={() => toggle(habit.id)}
              aria-pressed={active}
            >
              <span className={styles.chipIcon}>
                <HabitIcon icon={habit.icon} size={22} />
              </span>
              <span className={styles.chipName}>{habit.name[settings.lang]}</span>
              <span className={styles.chipMark}>{active && <Icon name="check" size={13} strokeWidth={3} />}</span>
            </button>
          )
        })}

        <button className={styles.ownChip} onClick={() => void finish(true)} disabled={saving}>
          <span className={styles.ownIcon}>
            <Icon name="plus" size={20} strokeWidth={2} />
          </span>
          <span className={styles.chipName}>
            {t.onboarding.addOwn}
            <span className={styles.ownHint}>{t.onboarding.addOwnHint}</span>
          </span>
        </button>
      </div>

      <button className={styles.primary} onClick={() => void finish()} disabled={saving}>
        {picked.length === 0 ? t.onboarding.skip : `${t.onboarding.add}: ${picked.length}`}
      </button>
    </div>
  )
}
