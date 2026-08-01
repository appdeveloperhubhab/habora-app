import { useRef, useState } from 'react'
import type { Weekday } from '../../types'
import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { hapticSelect, hapticSuccess } from '../../lib/haptics'
import { Icon } from '../../ui/Icon'
import { HabitIcon } from '../../ui/habitIcons'
import { STARTER_HABITS } from './starterHabits'
import styles from './OnboardingScreen.module.css'

/**
 * Первый запуск: приветствие и выбор готовых привычек.
 *
 * Раньше человек, открывший приложение впервые, видел пустой список и надпись
 * «Пока нет ни одной привычки» — по этому кадру невозможно понять ни что это
 * за приложение, ни с чего начать.
 *
 * Оба шага можно пройти насквозь, ничего не выбрав: навязывать чужие привычки
 * тому, кто пришёл со своими, — худшее первое впечатление. Для таких людей
 * внизу есть отдельный вход в редактор.
 */

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export function OnboardingScreen() {
  const { settings, createHabit, saveSettings } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)

  const [step, setStep] = useState<'welcome' | 'pick'>('welcome')
  const [picked, setPicked] = useState<string[]>([])
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

  const finish = async (thenCreateOwn = false) => {
    if (finishing.current) return
    finishing.current = true
    setSaving(true)

    // Создаём последовательно, а не через Promise.all: порядок в списке
    // должен совпасть с порядком выбора, а не с тем, кто быстрее записался.
    for (const id of picked) {
      const starter = STARTER_HABITS.find((item) => item.id === id)
      if (!starter) continue
      await createHabit({
        name: starter.name[settings.lang],
        description: '',
        icon: starter.icon,
        color: starter.color,
        tinted: true,
        schedule: { type: 'weekdays', days: EVERY_DAY, timesPerWeek: 7 },
        streakGoal: null,
        durationSec: null,
      })
    }

    if (picked.length > 0) hapticSuccess()
    await saveSettings({ onboarded: true })

    // Открываем пустой редактор поверх главного экрана: человек сразу
    // продолжает с того, зачем нажал, — заводить свою привычку.
    if (thenCreateOwn) nav.push({ name: 'habitEditor', habitId: null })
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
          <p className={styles.intro}>{t.onboarding.intro}</p>
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
