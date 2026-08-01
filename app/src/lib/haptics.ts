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
 * Стиль `soft` вместо `medium`: у него мягкая, «тягучая» отдача без резкого
 * щелчка — она совпадает по характеру с неспешной анимацией подтверждения.
 * В запасном варианте импульс тоже длиннее короткого тычка.
 */
export function hapticTick(): void {
  impact('soft', 26)
}

/** Более лёгкий отклик — снятие отметки. */
export function hapticUntick(): void {
  impact('light', 14)
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
