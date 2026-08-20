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
 * Пауза между двумя толчками отметки.
 *
 * Подобрана так, чтобы они слились в один увесистый: короче — сливаются в
 * неразличимое дребезжание, длиннее — распадаются на два отдельных щелчка.
 */
const TICK_GAP_MS = 55

/** Запасная вибрация отметки: толчок, пауза, толчок подлиннее. */
const TICK_PATTERN = [40, 45, 70]

/**
 * Основной отклик — момент отметки привычки выполненной.
 *
 * Здесь работают сразу два механизма, и это не перестраховка, а расчёт на
 * обе платформы.
 *
 * Telegram получает самый сильный стиль и два толчка подряд. Прежний `soft`
 * был выбран под характер анимации — мягкая, тягучая отдача, — но на телефоне
 * оказался почти неразличим: это слабейший из стилей, и на отметку, главное
 * действие приложения, его не хватало.
 *
 * Вибрация вдобавок, а не взамен: на Android собственный отклик Telegram
 * слаб при любом стиле, зато вибрации можно задать длительность, и вместе
 * они дают ощутимый вес. На iPhone эта половина просто отсутствует — там нет
 * Vibration API вовсе, — и остаются одни толчки, которые на нём и без того
 * отчётливые.
 */
export function hapticTick(): void {
  const hf = webApp?.HapticFeedback

  if (hf && safeCall(() => hf.impactOccurred('heavy'))) {
    window.setTimeout(() => safeCall(() => hf.impactOccurred('heavy')), TICK_GAP_MS)
  }

  fallbackVibrate(TICK_PATTERN)
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
