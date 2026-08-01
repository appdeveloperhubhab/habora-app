/**
 * Тонкая обёртка над Telegram WebApp SDK.
 *
 * Приложение должно одинаково запускаться и внутри Telegram, и в обычном
 * браузере во время разработки, поэтому здесь нет ни одного обращения к
 * `window.Telegram` без проверки: вне Telegram все вызовы тихо ничего не делают.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'error' | 'success' | 'warning'

interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: { id: number; first_name: string; language_code?: string } }
  colorScheme: 'light' | 'dark'
  version: string
  platform: string
  ready(): void
  expand(): void
  disableVerticalSwipes?(): void
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  HapticFeedback?: {
    impactOccurred(style: HapticStyle): void
    notificationOccurred(type: NotificationType): void
    selectionChanged(): void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export const webApp: TelegramWebApp | undefined = window.Telegram?.WebApp

/**
 * true — приложение действительно открыто внутри Telegram.
 *
 * Сам объект `WebApp` существует всегда, как только подключён скрипт SDK,
 * поэтому по нему судить нельзя. Признак реального клиента — платформа:
 * в обычном браузере она равна `unknown`.
 */
export const isTelegram = Boolean(webApp && webApp.platform !== 'unknown')

/**
 * Вызов метода SDK, который может отсутствовать в клиенте пользователя.
 *
 * Telegram не деградирует мягко: на методе, которого нет в его версии WebApp,
 * SDK выбрасывает исключение. Незакрытый вызов из обработчика события ломает
 * обновление интерфейса целиком, поэтому наружу такие ошибки не выпускаем —
 * функция просто не сработает на старом клиенте.
 */
export function safeCall(fn: () => void): boolean {
  try {
    fn()
    return true
  } catch {
    return false
  }
}

/** Сообщает Telegram, что интерфейс готов, и разворачивает окно на весь экран. */
export function initTelegram(): void {
  if (!webApp) return
  safeCall(() => webApp.ready())
  safeCall(() => webApp.expand())
  // Свайп вниз внутри Mini App закрывает окно — для списка привычек это мешает.
  safeCall(() => webApp.disableVerticalSwipes?.())
}

/** Красит системную шапку и фон Telegram под текущую тему приложения. */
export function syncChromeColors(background: string): void {
  if (!webApp) return
  safeCall(() => webApp.setHeaderColor?.(background))
  safeCall(() => webApp.setBackgroundColor?.(background))
}

/**
 * Управляет системной кнопкой «назад» Telegram.
 * Возвращает функцию отписки — её нужно вызвать при размонтировании экрана.
 */
export function setBackButton(handler: (() => void) | null): () => void {
  const back = webApp?.BackButton
  if (!back) return () => {}

  if (!handler) {
    safeCall(() => back.hide())
    return () => {}
  }

  safeCall(() => back.onClick(handler))
  safeCall(() => back.show())
  return () => {
    safeCall(() => back.offClick(handler))
    safeCall(() => back.hide())
  }
}

/** Язык интерфейса Telegram — используется как значение по умолчанию при первом запуске. */
export function telegramLang(): 'ru' | 'en' | null {
  const code = webApp?.initDataUnsafe?.user?.language_code
  if (!code) return null
  return code.startsWith('ru') ? 'ru' : 'en'
}

/** Тема Telegram — тоже только значение по умолчанию, дальше решает пользователь. */
export function telegramTheme(): 'dark' | 'light' | null {
  return webApp?.colorScheme ?? null
}

/** Подписанные Telegram данные для авторизации запросов к бэкенду (M7). */
export function initData(): string {
  return webApp?.initData ?? ''
}
