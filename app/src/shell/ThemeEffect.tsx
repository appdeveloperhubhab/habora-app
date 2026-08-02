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

  /*
   * Системная шапка Telegram красится в тот же цвет, что и верх приложения,
   * иначе на стыке видна чужая полоса.
   *
   * При градиенте это не цвет темы, а его верхний цвет: Telegram умеет только
   * сплошную заливку и про градиент не знает, поэтому шапка, покрашенная в
   * цвет темы, читалась бы как приклеенная сверху чёрная полоска.
   */
  useEffect(() => {
    const top =
      settings.backgroundKind === 'gradient'
        ? settings.gradientFrom
        : getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (top) syncChromeColors(top)
  }, [settings.theme, settings.backgroundKind, settings.gradientFrom])

  return null
}
