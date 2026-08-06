import { createContext, useContext } from 'react'

/**
 * Навигация сделана собственным стеком экранов, а не роутером по URL.
 *
 * Mini App живёт внутри Telegram, адресной строки у него нет, зато есть
 * системная кнопка «назад», которой нужно управлять вручную. Стек экранов
 * ложится на это точнее, чем history API, и заодно даёт контроль над
 * анимациями переходов.
 */

export type Screen =
  | { name: 'home' }
  | { name: 'habit'; habitId: string }
  | { name: 'habitEditor'; habitId: string | null }
  | { name: 'sharedHabit'; habitId: string; friendUserId: number }
  | { name: 'settings' }
  | { name: 'themeSettings' }
  | { name: 'timer' }

export type Tab = 'habits' | 'friends'

export interface NavValue {
  /** Текущий стек; первый элемент всегда `home`. */
  stack: Screen[]
  screen: Screen
  tab: Tab
  setTab(tab: Tab): void
  push(screen: Screen): void
  pop(): void
  /** Возврат к самому первому экрану — например, после удаления привычки. */
  reset(): void
}

export const NavContext = createContext<NavValue | null>(null)

export function useNav(): NavValue {
  const value = useContext(NavContext)
  if (!value) throw new Error('useNav must be used inside <NavProvider>')
  return value
}
