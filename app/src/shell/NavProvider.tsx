import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setBackButton } from '../lib/telegram'
import { hapticSelect } from '../lib/haptics'
import { NavContext, type NavValue, type Screen, type Tab } from './navigation'

const HOME: Screen = { name: 'home' }

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([HOME])
  const [tab, setTabState] = useState<Tab>('habits')

  const push = useCallback((screen: Screen) => {
    setStack((prev) => [...prev, screen])
  }, [])

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const reset = useCallback(() => setStack([HOME]), [])

  // Вибрация — побочный эффект, ему не место внутри обновления состояния:
  // React может вызвать функцию обновления повторно, а в StrictMode делает это
  // всегда, и тогда отклик срабатывает дважды.
  const setTab = useCallback((next: Tab) => {
    hapticSelect()
    setTabState(next)
  }, [])

  // Системная кнопка «назад» Telegram показывается ровно тогда, когда есть
  // куда возвращаться, и всегда снимает верхний экран стека.
  useEffect(() => {
    return setBackButton(stack.length > 1 ? pop : null)
  }, [stack.length, pop])

  // Аппаратная кнопка «назад» на Android и жест назад в браузере.
  useEffect(() => {
    if (stack.length <= 1) return

    history.pushState({ habora: true }, '')
    const onPopState = () => pop()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [stack.length, pop])

  const value: NavValue = useMemo(
    () => ({ stack, screen: stack[stack.length - 1], tab, setTab, push, pop, reset }),
    [stack, tab, setTab, push, pop, reset],
  )

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}
