import { useEffect } from 'react'
import { useStore } from '../store/context'
import { syncChromeColors } from '../lib/telegram'

/**
 * Переносит настройки внешнего вида на документ: тема — атрибутом на <html>,
 * акцент приложения и пользовательский фон — CSS-переменными.
 *
 * Компонент ничего не рендерит: тема должна применяться ко всему дереву сразу,
 * а не оборачивать его в лишний узел.
 */
export function ThemeEffect() {
  const { settings } = useStore()

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.style.setProperty('--accent', settings.accentColor)
    root.lang = settings.lang
  }, [settings.theme, settings.accentColor, settings.lang])

  useEffect(() => {
    const body = document.body

    if (settings.backgroundKind === 'gradient') {
      body.style.backgroundImage = `linear-gradient(160deg, ${settings.gradientFrom}, ${settings.gradientTo})`
      body.style.backgroundSize = 'cover'
      body.style.backgroundAttachment = 'fixed'
    } else {
      body.style.backgroundImage = ''
      body.style.backgroundAttachment = ''
    }
  }, [settings.backgroundKind, settings.gradientFrom, settings.gradientTo])

  // Системная шапка Telegram красится в тот же цвет, что и фон приложения,
  // иначе на стыке видна чужая полоса.
  useEffect(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (bg) syncChromeColors(bg)
  }, [settings.theme])

  return null
}
