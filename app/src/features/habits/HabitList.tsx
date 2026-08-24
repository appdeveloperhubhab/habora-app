import { useMemo, useState } from 'react'
import type { Habit } from '../../types'
import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { todayIso } from '../../lib/dates'
import { hapticWarning } from '../../lib/haptics'
import { shareLink } from '../../lib/telegram'
import { ActionSheet } from '../../ui/ActionSheet'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { HabitCard } from './HabitCard'
import { HabitCardBoard } from './HabitCardBoard'
import { ReorderList } from './ReorderList'
import { canEdit } from './canEdit'
import { NO_PARTNERS, partnersOf, type PersonMarks } from './participants'
import styles from './HabitList.module.css'

/**
 * Список карточек привычек со всем, что к ним прилагается: тап открывает
 * экран привычки, долгое нажатие — меню «Пригласить / Редактировать /
 * Удалить», вид карточек берётся из настроек.
 *
 * Отдельно от главного экрана он живёт потому, что тот же список нужен и на
 * вкладке «Друзья»: там под каждым человеком показаны общие с ним привычки —
 * теми же карточками и с тем же поведением. Раньше друзья рисовали привычки
 * по-своему, укороченной строкой, и одна и та же привычка выглядела в двух
 * местах двумя разными вещами.
 */
export function HabitList({
  habits,
  orderMode = false,
  hint = false,
  partnerId,
  padded = false,
}: {
  /** Какие привычки показать — отбирает вызывающий. */
  habits: Habit[]
  /**
   * Режим «Порядок». Перетаскивание меняет порядок всех привычек сразу,
   * поэтому включать его можно только там, где показаны все.
   */
  orderMode?: boolean
  /** Подсказка новичку у кнопки отметки первой карточки. */
  hint?: boolean
  /**
   * Чей цвет, кроме своего, показывать в долях дня. Не задан — все участники
   * привычки. На вкладке «Друзья» задан: там разговор идёт про вас двоих, и
   * третий цвет в клетке отвечал бы не на тот вопрос.
   */
  partnerId?: number
  /**
   * Список сам отступает от краёв экрана. Выключено, когда он вложен во
   * что-то, что уже отступило, — иначе карточки внутри оказались бы уже, чем
   * такие же на главном экране.
   */
  padded?: boolean
}) {
  const {
    settings,
    isDone,
    countOf,
    datesOf,
    partialDatesOf,
    markEntry,
    deleteHabit,
    saveSettings,
    inviteLink,
    reorderHabits,
    friends,
  } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)
  const today = todayIso()
  const view = settings.cardView

  const [menuFor, setMenuFor] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState<Habit | null>(null)

  /*
   * Напарники по каждой привычке. Считаются разом и запоминаются: список
   * зависит только от друзей, а не от отметок, и не должен пересобираться от
   * каждого нажатия галочки — иначе карточки перерисовывали бы свои сетки,
   * в годовом виде это четыре сотни клеток на ровном месте.
   */
  const partnersByHabit = useMemo(() => {
    const shown = partnerId === undefined ? friends : friends.filter((f) => f.userId === partnerId)
    const map = new Map<string, PersonMarks[]>()
    for (const habit of habits) map.set(habit.id, partnersOf(habit.id, shown))
    return map
  }, [habits, friends, partnerId])

  /*
   * Недобранные дни по привычкам — готовыми наборами. Сетка спрашивает про
   * каждый свой день, а в году их четыре сотни: перебирать список дат на
   * каждую клетку значит считать одно и то же тысячи раз.
   */
  const partialByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const habit of habits) {
      const days = partialDatesOf(habit.id)
      if (days.length > 0) map.set(habit.id, new Set(days))
    }
    return map
  }, [habits, partialDatesOf])

  /*
   * Нажатие на кнопку отметки. У привычки с нормой в один раз это по-прежнему
   * переключатель; у привычки с нормой — счётчик: пока норма не набрана,
   * прибавляем, а на набранной убавляем.
   *
   * Убавляем, а не обнуляем: три стакана набирались тремя касаниями, и стирать
   * их одним — слишком просто для случайного тычка.
   */
  const handleToggle = (habitId: string, done: boolean) => {
    void markEntry(habitId, today, done ? 'dec' : 'inc')
    if (!settings.hintSeen) void saveSettings({ hintSeen: true })
  }

  /**
   * Приглашение: спрашиваем у сервера ссылку и отдаём её Telegram — кому
   * переслать, человек выбирает там же, где у него и лежат друзья.
   *
   * Ссылки нет, когда приложение открыто без сервера: приглашать в этом
   * случае некуда, и молчание честнее неработающей кнопки.
   */
  const invite = async (habit: Habit) => {
    const url = await inviteLink(habit.id)
    if (!url) {
      hapticWarning()
      return
    }
    shareLink(url, t.actions.inviteText.replace('{habit}', habit.name))
  }

  return (
    <>
      {/*
        Ключ по виду заставляет React пересобрать список при переключении,
        и карточки появляются заново — иначе смена вида происходила бы
        мгновенной подменой, без всякого движения.
      */}
      <ReorderList
        key={view}
        ids={habits.map((habit) => habit.id)}
        enabled={orderMode}
        className={[
          styles.list,
          padded ? styles.padded : '',
          view === 'month' ? styles.tiles : '',
          orderMode ? styles.orderMode : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onReorder={(ids) => void reorderHabits(ids)}
        renderItem={(id) => {
          const habit = habits.find((item) => item.id === id)
          if (!habit) return null
          const index = habits.indexOf(habit)

          const done = isDone(habit.id, today)

          return view === 'week' ? (
            <HabitCard
              habit={habit}
              dates={datesOf(habit.id)}
              partners={partnersByHabit.get(habit.id) ?? NO_PARTNERS}
              done={done}
              count={countOf(habit.id, today)}
              hint={hint && index === 0}
              onToggle={() => handleToggle(habit.id, done)}
              onOpen={() => nav.push({ name: 'habit', habitId: habit.id })}
              onLongPress={() => setMenuFor(habit)}
            />
          ) : (
            <HabitCardBoard
              habit={habit}
              dates={datesOf(habit.id)}
              partners={partnersByHabit.get(habit.id) ?? NO_PARTNERS}
              partial={partialByHabit.get(habit.id)}
              done={done}
              count={countOf(habit.id, today)}
              size={view}
              t={t}
              onToggle={() => handleToggle(habit.id, done)}
              onOpen={() => nav.push({ name: 'habit', habitId: habit.id })}
              onLongPress={() => setMenuFor(habit)}
            />
          )
        }}
      />

      <ActionSheet
        open={menuFor !== null}
        title={menuFor?.name}
        cancelLabel={t.common.cancel}
        onClose={() => setMenuFor(null)}
        actions={[
          {
            id: 'invite',
            label: t.actions.invite,
            icon: 'friends',
            onSelect: () => menuFor && void invite(menuFor),
          },
          // «Редактировать» — только у создателя: у остальных форма
          // открывалась, но сохранить ничего не могла.
          ...(menuFor && canEdit(menuFor)
            ? [
                {
                  id: 'edit',
                  label: t.actions.edit,
                  icon: 'pencil' as const,
                  onSelect: () => nav.push({ name: 'habitEditor', habitId: menuFor.id }),
                },
              ]
            : []),
          {
            id: 'delete',
            label: t.actions.delete,
            icon: 'close',
            danger: true,
            onSelect: () => {
              hapticWarning()
              setDeleting(menuFor)
            },
          },
        ]}
      />

      {deleting && (
        <ConfirmDialog
          // То же предупреждение, что и в редакторе: удалить общую привычку
          // можно и отсюда, долгим нажатием по карточке, — а последствия у
          // обоих путей одни.
          title={
            (deleting.members?.length ?? 0) > 1 ? t.editor.deleteSharedTitle : t.editor.deleteTitle
          }
          text={
            (deleting.members?.length ?? 0) > 1 ? t.editor.deleteSharedText : t.editor.deleteText
          }
          confirmLabel={t.editor.deleteConfirm}
          cancelLabel={t.common.cancel}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void deleteHabit(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </>
  )
}
