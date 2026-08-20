import { safeCall, webApp } from './telegram'

/**
 * Тактильный отклик. Основной путь — механизм Telegram, запасной —
 * Vibration API браузера, который на Android даёт похожее ощущение
 * при разработке вне Telegram.
 *
 * Звука нет нигде и никогда: по ТЗ отклик должен ощущаться, а не слышаться.
 *
 * Все вызовы проходят через `safeCall`: в клиентах Telegram старше 6.1
 * методы Haptic Feedback отсутствуют и выбрасывают исключение. Без этой
 * защиты вибрация роняла бы обработчик нажатия целиком — а нажатие на
 * галочку обязано срабатывать даже там, где вибрации нет.
 */

function fallbackVibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    safeCall(() => navigator.vibrate(pattern))
  }
}

function impact(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid', pattern: number | number[]): void {
  const hf = webApp?.HapticFeedback
  if (hf && safeCall(() => hf.impactOccurred(style))) return
  // Стили `soft` и `rigid` есть не во всех клиентах; там, где их нет,
  // отдаём привычный `medium`, а уж потом уходим в браузерную вибрацию.
  if (hf && style !== 'medium' && safeCall(() => hf.impactOccurred('medium'))) return
  fallbackVibrate(pattern)
}

function notify(type: 'success' | 'warning' | 'error', pattern: number[]): void {
  const hf = webApp?.HapticFeedback
  if (!hf || !safeCall(() => hf.notificationOccurred(type))) fallbackVibrate(pattern)
}

/**
 * Основной отклик — момент отметки привычки выполненной.
 *
 * Ровно один толчок, и стиль выбран по характеру, а не по силе.
 *
 * Через все пять стилей Telegram отметка прошла не зря. `soft`, стоявший
 * изначально, почти не различался на телефоне. `heavy` различался хорошо, но
 * это глухой тяжёлый удар — сильный и невнятный разом, как будто что-то
 * стукнуло, а не как будто действие приняли.
 *
 * `rigid` — короткий чёткий щелчок, отдача тумблера. Он не тяжелее `heavy`,
 * он резче: тело ощущает не массу, а точность, и именно это читается как
 * подтверждение. Ровно то, чем отметка и является.
 *
 * Одним толчком, а не очередью: два-три подряд ощущаются не усиленным
 * откликом, а непрерывным дребезжанием.
 */
export function hapticTick(): void {
  // Запасная вибрация — для клиентов без Haptic Feedback. Тридцать пять
  // миллисекунд: ниже тридцати импульс на Android теряется, выше
  // шестидесяти перестаёт быть щелчком и начинает гудеть.
  impact('rigid', 35)
}

/**
 * Более лёгкий отклик — снятие отметки.
 *
 * Тоже усилен, с `light` до `medium`: рядом с потяжелевшей отметкой прежний
 * лёгкий тычок перестал бы ощущаться вовсе, и снятие выглядело бы как
 * несработавшее нажатие.
 */
export function hapticUntick(): void {
  impact('medium', 22)
}

/** Переключение вкладки, выбор в списке — самый лёгкий отклик. */
export function hapticSelect(): void {
  const hf = webApp?.HapticFeedback
  if (!hf || !safeCall(() => hf.selectionChanged())) fallbackVibrate(5)
}

/** Успех: привычка создана, настройки сохранены. */
export function hapticSuccess(): void {
  notify('success', [10, 40, 10])
}

/** Предупреждение: подтверждение удаления, ошибка валидации. */
export function hapticWarning(): void {
  notify('warning', [20, 60, 20])
}
