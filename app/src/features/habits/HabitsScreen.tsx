import { useEffect, useMemo, useState } from 'react'
import type { Habit } from '../../types'
import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { todayIso } from '../../lib/dates'
import { hapticWarning } from '../../lib/haptics'
import { shareLink } from '../../lib/telegram'
import { EmptyState } from '../../ui/EmptyState'
import { ActionSheet } from '../../ui/ActionSheet'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { HabitCard } from './HabitCard'
import { HabitCardBoard } from './HabitCardBoard'
import { ReorderList } from './ReorderList'
import { canEdit } from './canEdit'
import { NO_PARTNERS, partnersOf, type PersonMarks } from './participants'
import styles from './HabitsScreen.module.css'

/**
 * Список привычек — главный экран приложения.
 *
 * Короткий тап по карточке открывает экран привычки со всей её аналитикой,
 * долгое нажатие — быстрое меню «Редактировать / Удалить», чтобы ради
 * удаления не заходить внутрь.
 *
 * Вид карточек общий для всех привычек и переключается в режиме «Порядок».
 */
export function HabitsScreen({ orderMode = false }: { orderMode?: boolean }) {
  const {
    habits,
    settings,
    isDone,
    datesOf,
    toggleEntry,
    deleteHabit,
    saveSettings,
    inviteLink,
    reorderHabits,
    friends,
    refreshFriends,
  } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)
  const today = todayIso()
  const view = settings.cardView

  const [menuFor, setMenuFor] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState<Habit | null>(null)

  /*
   * Отметки друзей ставятся на их телефонах и сами собой не приходят. Раньше
   * их спрашивали только на вкладке «Друзья» и внутри привычки — а теперь они
   * нужны и здесь, на первом же экране: без них совместные дни красились бы
   * одним цветом до тех пор, пока человек не сходит к друзьям и обратно.
   */
  useEffect(() => {
    void refreshFriends()
  }, [refreshFriends])

  /*
   * Напарники по каждой привычке. Считаются разом и запоминаются: список
   * зависит только от друзей, а не от отметок, и не должен пересобираться от
   * каждого нажатия галочки — иначе карточки перерисовывали бы свои сетки,
   * в годовом виде это четыре сотни клеток на ровном месте.
   */
  const partnersByHabit = useMemo(() => {
    const map = new Map<string, PersonMarks[]>()
    for (const habit of habits) map.set(habit.id, partnersOf(habit.id, friends))
    return map
  }, [habits, friends])

  if (habits.length === 0) {
    return <EmptyState title={t.habits.empty} hint={t.habits.emptyHint} />
  }

  // Единственное действие, которое стоит объяснить новичку. Подсказка живёт
  // до первой отметки — не по таймеру и не по числу показов.
  const showHint = !settings.hintSeen && !orderMode

  const handleToggle = (habitId: string) => {
    void toggleEntry(habitId, today)
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
      {showHint && <p className={styles.hint}>{t.onboarding.hint}</p>}

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

          return view === 'week' ? (
            <HabitCard
              habit={habit}
              dates={datesOf(habit.id)}
              partners={partnersByHabit.get(habit.id) ?? NO_PARTNERS}
              done={isDone(habit.id, today)}
              hint={showHint && index === 0}
              onToggle={() => handleToggle(habit.id)}
              onOpen={() => nav.push({ name: 'habit', habitId: habit.id })}
              onLongPress={() => setMenuFor(habit)}
            />
          ) : (
            <HabitCardBoard
              habit={habit}
              dates={datesOf(habit.id)}
              partners={partnersByHabit.get(habit.id) ?? NO_PARTNERS}
              done={isDone(habit.id, today)}
              size={view}
              t={t}
              onToggle={() => handleToggle(habit.id)}
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
