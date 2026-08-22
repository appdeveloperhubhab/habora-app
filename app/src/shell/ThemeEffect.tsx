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

  /*
   * Градиент кладётся переменной на весь документ, а не заливкой одного
   * элемента.
   *
   * Раньше он жил только на `body` и был виден только на главном списке:
   * экраны привычки, настроек и редактора лежат поверх и накрывали его
   * сплошной заливкой темы — переход туда выглядел так, будто выбранный фон
   * выключили. Теперь тот же градиент доступен всем, кто рисует полный экран,
   * а пометка `data-bg` заодно включает полупрозрачные карточки в токенах.
   */
  useEffect(() => {
    const root = document.documentElement

    if (settings.backgroundKind === 'gradient') {
      root.style.setProperty(
        '--app-gradient',
        `linear-gradient(160deg, ${settings.gradientFrom}, ${settings.gradientTo})`,
      )
      root.dataset.bg = 'gradient'
    } else {
      root.style.removeProperty('--app-gradient')
      delete root.dataset.bg
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
