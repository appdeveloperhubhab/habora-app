/**
 * Тонкая обёртка над Telegram WebApp SDK.
 *
 * Приложение должно одинаково запускаться и внутри Telegram, и в обычном
 * браузере во время разработки, поэтому здесь нет ни одного обращения к
 * `window.Telegram` без проверки: вне Telegram все вызовы тихо ничего не делают.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'error' | 'success' | 'warning'

/** Отступы, которые нельзя занимать: вырезы экрана и кнопки самого Telegram. */
interface Inset {
  top: number
  bottom: number
  left: number
  right: number
}

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
  /** Полноэкранный режим; появился не во всех клиентах. */
  requestFullscreen?(): void
  isFullscreen?: boolean
  /** Вырезы самого устройства: чёлка, полоса жеста. */
  safeAreaInset?: Inset
  /** Место, занятое кнопками Telegram поверх приложения в полноэкранном режиме. */
  contentSafeAreaInset?: Inset
  onEvent?(event: string, handler: () => void): void
  offEvent?(event: string, handler: () => void): void
  /** Открывает ссылку t.me внутри Telegram, не выбрасывая в браузер. */
  openTelegramLink?(url: string): void
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

/**
 * Переносит отступы Telegram в CSS-переменные `--top-inset` / `--bottom-inset`.
 *
 * В полноэкранном режиме приложение занимает весь экран — и место под вырезом
 * устройства, и место под кнопками «Закрыть» и «...», которые Telegram рисует
 * поверх. Обе высоты складываются, иначе наша верхняя панель окажется под ними.
 *
 * Значение берётся не меньше того, что сообщает сам браузер: на клиентах,
 * которые отдают нули, отступы должны остаться прежними, а не схлопнуться.
 */
function syncInsets(): void {
  const device = webApp?.safeAreaInset
  const controls = webApp?.contentSafeAreaInset
  if (!device && !controls) return

  const root = document.documentElement

  /*
   * Высота кнопок Telegram. Часть клиентов её не сообщает — там остался бы
   * запас только под вырез экрана, и кнопки легли бы поверх нашей шапки.
   * Резерв нужен лишь в полноэкранном режиме: в обычном кнопки лежат вне
   * приложения и ничего не перекрывают.
   */
  const controlsTop = controls?.top || (webApp?.isFullscreen ? 48 : 0)

  const top = (device?.top ?? 0) + controlsTop
  const bottom = (device?.bottom ?? 0) + (controls?.bottom ?? 0)

  root.style.setProperty('--top-inset', `max(env(safe-area-inset-top), ${top}px)`)
  root.style.setProperty('--bottom-inset', `max(env(safe-area-inset-bottom), ${bottom}px)`)
}

/**
 * Полноэкранный режим: Telegram убирает свою шапку с названием приложения,
 * а «Закрыть» и «...» превращает в компактные кнопки поверх содержимого.
 *
 * Только на телефонах: на компьютере Mini App и так открыт в отдельном окне,
 * и растягивать его на весь экран незачем.
 */
function enterFullscreen(): void {
  if (!webApp) return
  if (webApp.platform !== 'ios' && webApp.platform !== 'android') return
  const request = webApp.requestFullscreen
  if (!request) return
  safeCall(() => request.call(webApp))
}

/**
 * Сообщает Telegram, что интерфейс готов, и настраивает окно.
 * Возвращает функцию отписки от событий Telegram.
 */
export function initTelegram(): () => void {
  if (!webApp) return () => {}

  safeCall(() => webApp.ready())
  safeCall(() => webApp.expand())
  // Свайп вниз внутри Mini App закрывает окно — для списка привычек это мешает.
  safeCall(() => webApp.disableVerticalSwipes?.())

  enterFullscreen()
  syncInsets()

  // Отступы меняются не сразу: полноэкранный режим включается асинхронно, и
  // поворот экрана тоже их сдвигает. Пересчитываем по событиям Telegram.
  const events = ['fullscreenChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged']
  const on = webApp.onEvent
  const off = webApp.offEvent
  if (!on || !off) return () => {}

  for (const event of events) safeCall(() => on.call(webApp, event, syncInsets))
  return () => {
    for (const event of events) safeCall(() => off.call(webApp, event, syncInsets))
  }
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

/**
 * Идентификатор текущего человека в Telegram; null вне Telegram.
 *
 * Берётся из непроверенной части данных и годится только для показа — решить,
 * чей аватар не рисовать на своей же карточке. Всё, что касается прав и
 * доступа, решает сервер по подписи.
 */
export function currentUserId(): number | null {
  return webApp?.initDataUnsafe?.user?.id ?? null
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

/**
 * Отдаёт ссылку-приглашение в системное окно «кому переслать».
 *
 * Выбор друга делает сам Telegram — своего списка контактов у приложения нет
 * и быть не должно. Вне Telegram (при разработке) открываем ссылку обычным
 * способом, чтобы кнопка не выглядела сломанной.
 */
export function shareLink(url: string, text: string): void {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`

  if (webApp?.openTelegramLink && safeCall(() => webApp.openTelegramLink!(share))) return
  window.open(share, '_blank')
}
