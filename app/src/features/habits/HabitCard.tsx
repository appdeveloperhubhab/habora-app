import { useRef, useState } from 'react'
import type { Habit } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { hapticSelect } from '../../lib/haptics'
import { HabitIcon } from '../../ui/habitIcons'
import { weekProgress } from '../../lib/streak'
import { scheduleLabel } from './scheduleLabel'
import { DayBars } from './DayBars'
import { HabitMembers } from './HabitMembers'
import { CheckButton } from './CheckButton'
import styles from './HabitCard.module.css'

/**
 * Карточка привычки: капсульная форма, фон мягко тонирован цветом привычки,
 * слева выбранная пользователем иконка, справа от названия — неделя полосками,
 * и кнопка отметки у самого края.
 *
 * Серия (streak) здесь намеренно не показывается — по ТЗ эта цифра живёт
 * только внутри самой привычки, в списке она лишняя.
 */

interface Props {
  habit: Habit
  dates: string[]
  done: boolean
  onToggle(): void
  /** Короткий тап — экран привычки с её аналитикой. */
  onOpen(): void
  /** Долгое нажатие — быстрое меню, чтобы не заходить внутрь ради удаления. */
  onLongPress(): void
  /** Подсказка новичку у кнопки отметки. */
  hint?: boolean
}

const LONG_PRESS_MS = 480

export function HabitCard({ habit, dates, done, onToggle, onOpen, onLongPress, hint = false }: Props) {
  const { settings } = useStore()
  const t = dict(settings.lang)

  // Счётчик отметок: по нему перезапускаются обе анимации подтверждения.
  const [pulseKey, setPulseKey] = useState(0)

  const longPressTimer = useRef<number | undefined>(undefined)
  const longPressFired = useRef(false)

  const startLongPress = () => {
    longPressFired.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      hapticSelect()
      onLongPress()
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    window.clearTimeout(longPressTimer.current)
  }

  const handleOpen = () => {
    // Долгое нажатие уже показало меню — обычный переход не нужен.
    if (longPressFired.current) return
    onOpen()
  }

  const handleToggle = () => {
    // Только при простановке отметки: волна по неделе и вспышка карточки —
    // подтверждение выполненного, а снятие отметки праздновать не с чем.
    if (!done) setPulseKey((key) => key + 1)
    onToggle()
  }

  /*
   * Вспышку карточки нельзя перезапустить сменой ключа — пересоздание самой
   * карточки сбросило бы её состояние. Поэтому две одинаковые анимации под
   * разными именами чередуются: смена класса заставляет браузер начать заново.
   */
  const flashClass = pulseKey === 0 ? '' : pulseKey % 2 === 1 ? styles.flashA : styles.flashB

  const subtitle = habit.description || scheduleLabel(habit.schedule, settings.lang, t)

  return (
    <article
      className={[styles.card, habit.tinted ? '' : styles.plain, flashClass].filter(Boolean).join(' ')}
      style={{ '--habit': habit.color } as React.CSSProperties}
    >
      {/*
        Кнопка открытия — пустой слой во всю карточку, а не обёртка вокруг
        названия. Раньше открывала только левая половина: тап по полоскам
        недели или рядом с галочкой не делал ничего, хотя выглядел как тап по
        карточке. Теперь открывает вся, кроме самой галочки — она лежит выше
        и забирает свои нажатия себе.
      */}
      <button
        className={styles.open}
        onClick={handleOpen}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={habit.name}
      />

      <span className={styles.face}>
        <span className={styles.icon}>
          <HabitIcon icon={habit.icon} size={20} />
        </span>

        <span className={styles.body}>
          <span className={styles.name}>{habit.name}</span>
          {/* Аватарки встают в строку подписи: свободного места на узкой
              карточке больше нигде нет, а расписание и так не первое,
              что нужно знать о совместной привычке. */}
          <span className={styles.subtitle}>
            <HabitMembers habit={habit} size={16} />
            <span className={styles.subtitleText}>{subtitle}</span>
          </span>
        </span>
      </span>

      {/* Полоски — прямой ребёнок карточки, а не части с текстом: только так
          их ширину можно задать в долях самой карточки. */}
      <DayBars days={weekProgress(dates)} color={habit.color} pulseKey={pulseKey} />

      <CheckButton done={done} color={habit.color} hint={hint} onToggle={handleToggle} />
    </article>
  )
}
