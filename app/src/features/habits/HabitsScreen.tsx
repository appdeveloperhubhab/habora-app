import { useState } from 'react'
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
export function HabitsScreen({ query = '', orderMode = false }: { query?: string; orderMode?: boolean }) {
  const { habits, settings, isDone, datesOf, toggleEntry, deleteHabit, saveSettings, inviteLink } =
    useStore()
  const nav = useNav()
  const t = dict(settings.lang)
  const today = todayIso()
  const view = settings.cardView

  const [menuFor, setMenuFor] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState<Habit | null>(null)

  // Ищем и по названию, и по описанию: человек может помнить не заголовок,
  // а уточнение вроде «2 литра».
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? habits.filter(
        (habit) =>
          habit.name.toLowerCase().includes(needle) || habit.description.toLowerCase().includes(needle),
      )
    : habits

  if (habits.length === 0) {
    return <EmptyState title={t.habits.empty} hint={t.habits.emptyHint} />
  }

  if (visible.length === 0) {
    return <EmptyState title={t.common.notFound} hint={t.common.notFoundHint} />
  }

  // Единственное действие, которое стоит объяснить новичку. Подсказка живёт
  // до первой отметки — не по таймеру и не по числу показов.
  const showHint = !settings.hintSeen && !needle && !orderMode

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
      <div
        key={view}
        className={[styles.list, view === 'grid' ? styles.tiles : '', orderMode ? styles.orderMode : '']
          .filter(Boolean)
          .join(' ')}
      >
        {visible.map((habit, index) =>
          view === 'week' ? (
            <HabitCard
              key={habit.id}
              habit={habit}
              dates={datesOf(habit.id)}
              done={isDone(habit.id, today)}
              hint={showHint && index === 0}
              onToggle={() => handleToggle(habit.id)}
              onOpen={() => nav.push({ name: 'habit', habitId: habit.id })}
              onLongPress={() => setMenuFor(habit)}
            />
          ) : (
            <HabitCardBoard
              key={habit.id}
              habit={habit}
              dates={datesOf(habit.id)}
              done={isDone(habit.id, today)}
              size={view}
              t={t}
              onToggle={() => handleToggle(habit.id)}
              onOpen={() => nav.push({ name: 'habit', habitId: habit.id })}
              onLongPress={() => setMenuFor(habit)}
            />
          ),
        )}
      </div>

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
          {
            id: 'edit',
            label: t.actions.edit,
            icon: 'pencil',
            onSelect: () => menuFor && nav.push({ name: 'habitEditor', habitId: menuFor.id }),
          },
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
          title={t.editor.deleteTitle}
          text={t.editor.deleteText}
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
