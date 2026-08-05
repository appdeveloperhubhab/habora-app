import { useCallback, useEffect } from 'react'
import type { Habit } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { hapticWarning } from '../../lib/haptics'
import { shareLink } from '../../lib/telegram'
import { ActionSheet } from '../../ui/ActionSheet'

/**
 * Выбор привычки, в которую зовём друга.
 *
 * Приглашают всегда в конкретную привычку, а не «в приложение»: делятся
 * привычкой, а не аккаунтом, и без неё приглашению некуда вести.
 *
 * Когда привычка одна, спрашивать не о чем — сразу открываем пересылку.
 */
export function InviteSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { habits, settings, inviteLink } = useStore()
  const t = dict(settings.lang)

  const share = useCallback(
    async (habit: Habit) => {
      const url = await inviteLink(habit.id)
      if (!url) {
        // Ссылки нет, когда приложение работает без сервера: приглашать некуда,
        // и молчание честнее кнопки, которая делает вид, что сработала.
        hapticWarning()
        return
      }
      shareLink(url, t.actions.inviteText.replace('{habit}', habit.name))
    },
    [inviteLink, t.actions.inviteText],
  )

  /*
   * Единственную привычку пропускаем через выбор молча — но именно эффектом,
   * а не прямо при отрисовке: React вправе отрисовать компонент дважды, и
   * окно пересылки открылось бы два раза подряд.
   */
  const only = open && habits.length === 1 ? habits[0] : null
  useEffect(() => {
    if (!only) return
    void share(only)
    onClose()
  }, [only, share, onClose])

  if (!open || habits.length < 2) return null

  return (
    <ActionSheet
      open
      title={t.actions.inviteWhich}
      cancelLabel={t.common.cancel}
      onClose={onClose}
      actions={habits.map((habit) => ({
        id: habit.id,
        label: habit.name,
        icon: 'friends' as const,
        onSelect: () => void share(habit),
      }))}
    />
  )
}
