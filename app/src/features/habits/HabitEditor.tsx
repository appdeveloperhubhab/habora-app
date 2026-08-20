import { useState } from 'react'
import type { Habit, HabitInput, Weekday } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { weekdayShort } from '../../lib/dates'
import { hapticSelect, hapticSuccess, hapticWarning } from '../../lib/haptics'
import { shareLink } from '../../lib/telegram'
import { nearestHabitColor, nextDefaultColor } from '../../theme/palette'
import { DEFAULT_HABIT_ICON } from '../../ui/habitIconSet'
import { HabitIcon } from '../../ui/habitIcons'
import { HabitMembers } from './HabitMembers'
import { ColorStrip } from '../../ui/ColorStrip'
import { IconPicker } from '../../ui/IconPicker'
import { Sheet } from '../../ui/Sheet'
import { DEFAULT_TIME, TimePicker } from '../../ui/TimePicker'
import { Toggle } from '../../ui/Toggle'
import { Icon } from '../../ui/Icon'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { ActivityGrid } from './detail/ActivityGrid'
import styles from './HabitEditor.module.css'

/**
 * Создание и редактирование привычки — одно место для всех её параметров.
 *
 * Форма намеренно короткая: набор иконок вынесен в отдельное окно, иначе он
 * занимал несколько экранов прокрутки и всё остальное терялось под ним.
 */

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * Убирает клавиатуру по нажатию на клавишу ввода.
 *
 * Атрибут `enterkeyhint` у полей ниже меняет только надпись на этой клавише —
 * с «ввод» на «готово». Закрывать клавиатуру сам по себе он не станет:
 * телефон ждёт, что это сделает страница. Без этого обработчика клавиша
 * называлась бы «готово» и не делала ничего.
 *
 * Отменяем и стандартное действие: в форме клавиша ввода отправляет её,
 * а здесь отправлять нечего — ниже ещё расписание, напоминание и цвет.
 */
function dismissKeyboard(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  event.currentTarget.blur()
}

export function HabitEditor({ habit, onClose }: { habit: Habit | null; onClose(): void }) {
  const { habits, settings, datesOf, createHabit, updateHabit, deleteHabit, inviteLink } = useStore()
  const t = dict(settings.lang)

  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [icon, setIcon] = useState(habit?.icon ?? DEFAULT_HABIT_ICON)
  /*
   * Цвет привычки, заведённой до сокращения палитры, подменяем ближайшим из
   * набора. Иначе в редакторе не было бы выделено ни одной плитки — а показать
   * одиннадцатую, свою, значит сломать ровный ряд пять на пять.
   *
   * Подмена видна сразу: превью сверху перекрашивается при открытии, и человек
   * замечает её до сохранения, а не постфактум.
   */
  const [color, setColor] = useState(
    habit ? nearestHabitColor(habit.color) : nextDefaultColor(habits.length),
  )
  const [tinted, setTinted] = useState(habit?.tinted ?? true)
  /*
   * У привычки, заведённой по старому расписанию «N раз в неделю», сохранённый
   * список дней мог остаться от прежних правок и не значить ничего. Открываем
   * такую на всех семи днях: это ближайшее к «без ограничения по дням», и
   * человек снимет лишние сам.
   */
  const [days, setDays] = useState<Weekday[]>(
    habit && habit.schedule.type === 'weekdays' ? habit.schedule.days : ALL_WEEKDAYS,
  )
  /*
   * У новой привычки напоминание включено сразу.
   *
   * Выключенный переключатель человек проходил мимо: он читается как «эта
   * возможность есть, если понадобится», а не как «выберите час». Включённый
   * сразу показывает готовое время — остаётся либо поправить его под себя,
   * либо выключить, и оба действия очевидны.
   *
   * У уже заведённой привычки берётся её собственное значение: там выключено
   * значит выключено, и трогать чужой выбор нельзя.
   */
  const [remindAt, setRemindAt] = useState<string | null>(
    habit ? habit.remindAt : DEFAULT_TIME,
  )

  const [error, setError] = useState<string | null>(null)
  const [iconSheet, setIconSheet] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggleDay = (day: Weekday) => {
    hapticSelect()
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  /**
   * Записывает привычку и возвращает её id; null — форма не заполнена.
   *
   * Выделено из обработчика кнопки, потому что сохранить нужно ещё и по
   * «Пригласить друга»: ссылка ведёт в конкретную привычку, и у новой,
   * ещё не записанной, вести приглашению некуда.
   */
  const persist = async (): Promise<string | null> => {
    const trimmed = name.trim()
    if (!trimmed) {
      hapticWarning()
      setError(t.editor.nameRequired)
      return null
    }
    if (days.length === 0) {
      hapticWarning()
      setError(t.editor.daysRequired)
      return null
    }

    const input: HabitInput = {
      name: trimmed,
      description: description.trim(),
      icon,
      color,
      tinted,
      // Расписание теперь всегда по дням недели. `timesPerWeek` остаётся в типе
      // ради привычек, заведённых до этого, и хранит прежнее значение по
      // умолчанию — на расчёт серии у них оно уже не влияет.
      schedule: { type: 'weekdays', days, timesPerWeek: 3 },
      /*
       * Цель по серии и длительность убраны из формы, но не из привычки:
       * заданные до этого — сохраняются, а не обнуляются молча при первой же
       * правке названия. Новая привычка заводится без них.
       */
      streakGoal: habit?.streakGoal ?? null,
      durationSec: habit?.durationSec ?? null,
      remindAt,
    }

    if (habit) {
      await updateHabit(habit.id, input)
      return habit.id
    }
    return (await createHabit(input)).id
  }

  const handleSave = async () => {
    if ((await persist()) === null) return
    hapticSuccess()
    onClose()
  }

  /**
   * Позвать друга прямо из редактора.
   *
   * Привычка сохраняется до пересылки — и новая, и открытая на правку.
   * Иначе друг перешёл бы по ссылке в привычку под старым названием или
   * вовсе не нашёл бы её, если она ещё не заведена.
   *
   * Редактор после этого закрывается: привычка уже записана, и оставлять
   * форму открытой значило бы завести её вторую копию следующим сохранением.
   */
  const handleInvite = async () => {
    const habitId = await persist()
    if (habitId === null) return

    const url = await inviteLink(habitId)
    if (!url) {
      // Ссылки нет, когда приложение открыто без сервера: приглашать некуда,
      // и молчание честнее кнопки, которая делает вид, что сработала.
      hapticWarning()
      onClose()
      return
    }

    shareLink(url, t.actions.inviteText.replace('{habit}', name.trim()))
    onClose()
  }

  const handleDelete = async () => {
    if (!habit) return
    await deleteHabit(habit.id)
    onClose()
  }

  return (
    <div className={styles.screen} style={{ '--habit': color } as React.CSSProperties}>
      <header className={styles.bar}>
        <button className={styles.close} onClick={onClose} aria-label={t.common.cancel}>
          <Icon name="close" size={20} />
        </button>
        <h2 className={styles.title}>{habit ? t.editor.editTitle : t.editor.newTitle}</h2>
        <button className={styles.save} onClick={handleSave} aria-label={t.common.save}>
          <Icon name="check" size={22} />
        </button>
      </header>

      <div className={styles.content}>
        {/* Превью перекрашивается сразу при выборе цвета, до сохранения. */}
        <ActivityGrid dates={habit ? datesOf(habit.id) : []} color={color} lang={settings.lang} />

        <div className={styles.nameRow}>
          <button className={styles.iconButton} onClick={() => setIconSheet(true)} aria-label={t.editor.icon}>
            <HabitIcon icon={icon} size={24} />
          </button>

          <input
            className={styles.nameInput}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder={t.editor.namePlaceholder}
            maxLength={60}
            autoFocus={!habit}
            enterKeyHint="done"
            onKeyDown={dismissKeyboard}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.colorBlock}>
          <ColorStrip value={color} onChange={setColor} />

          <div className={styles.tintRow}>
            <span className={styles.tintText}>
              <span className={styles.tintTitle}>{t.editor.tinted}</span>
              <span className={styles.tintHint}>{t.editor.tintedHint}</span>
            </span>
            <Toggle checked={tinted} color={color} onChange={setTinted} label={t.editor.tinted} />
          </div>
        </div>

        {/* У поля есть подпись, а не только placeholder: без неё было
            непонятно, что вообще сюда пишут, — «Необязательно» отвечало,
            что заполнять не обязательно, но не отвечало, что именно. */}
        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.description}</h3>
          <input
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.editor.descriptionPlaceholder}
            maxLength={120}
            enterKeyHint="done"
            onKeyDown={dismissKeyboard}
          />
        </section>

        {/*
          Позвать друга можно прямо отсюда, а не только из готовой привычки.
          Совместная привычка чаще всего и задумывается вдвоём — решение
          «делаем вместе» принимается в тот же момент, что и «заводим», и
          отправлять человека за этим на другой экран значит терять его там.
        */}
        <section className={styles.block}>
          <h3 className={styles.heading}>{t.tabs.friends}</h3>
          {!habit && <p className={styles.hint}>{t.editor.inviteHint}</p>}

          <button className={styles.inviteButton} onClick={() => void handleInvite()}>
            <Icon name="plus" size={18} />
            <span className={styles.inviteLabel}>{t.actions.invite}</span>
            {/* Кто уже внутри — сразу видно, звать ли ещё. */}
            {habit && <HabitMembers habit={habit} size={24} />}
          </button>
        </section>

        {/* Только дни недели. Прежний второй режим — «N раз в неделю» —
            убран: он задавал ту же привычку вторым способом, а серия по нему
            считалась в неделях, и две привычки рядом показывали числа,
            которые нельзя сравнить между собой. */}
        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.schedule}</h3>
          <p className={styles.hint}>{t.editor.scheduleHint}</p>

          <div className={styles.days}>
            {ALL_WEEKDAYS.map((day) => (
              <button
                key={day}
                className={days.includes(day) ? `${styles.day} ${styles.dayOn}` : styles.day}
                onClick={() => toggleDay(day)}
                aria-pressed={days.includes(day)}
              >
                {weekdayShort(day, settings.lang)}
              </button>
            ))}
          </div>
        </section>

        {/* Напоминание идёт сразу за расписанием: оба отвечают на вопрос
            «когда», только одно днями, а другое часами. */}
        <section className={styles.block}>
          <h3 className={styles.heading}>{t.editor.remind}</h3>
          <p className={styles.hint}>{t.editor.remindHint}</p>
          <TimePicker
            value={remindAt}
            color={color}
            labels={{ on: t.editor.remindOn, off: t.editor.remindOff }}
            onChange={setRemindAt}
          />
        </section>

        {habit && (
          <button
            className={styles.deleteButton}
            onClick={() => {
              hapticWarning()
              setConfirmDelete(true)
            }}
          >
            <Icon name="close" size={18} />
            {t.common.delete}
          </button>
        )}
      </div>

      <Sheet open={iconSheet} title={t.editor.iconSheet} onClose={() => setIconSheet(false)}>
        <IconPicker
          value={icon}
          color={color}
          onChange={(next) => {
            setIcon(next)
            setIconSheet(false)
          }}
        />
      </Sheet>

      {confirmDelete && (
        <ConfirmDialog
          title={t.editor.deleteTitle}
          text={t.editor.deleteText}
          confirmLabel={t.editor.deleteConfirm}
          cancelLabel={t.common.cancel}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

