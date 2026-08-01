import { useEffect } from 'react'
import { StoreProvider } from './store/StoreProvider'
import { NavProvider } from './shell/NavProvider'
import { ThemeEffect } from './shell/ThemeEffect'
import { AppShell } from './shell/AppShell'
import { initTelegram } from './lib/telegram'

export default function App() {
  // Telegram должен узнать о готовности интерфейса один раз при старте.
  useEffect(() => initTelegram(), [])

  return (
    <StoreProvider>
      <ThemeEffect />
      <NavProvider>
        <AppShell />
      </NavProvider>
    </StoreProvider>
  )
}
