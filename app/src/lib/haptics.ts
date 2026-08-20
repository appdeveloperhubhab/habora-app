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
 * Ровно один толчок, самый сильный из тех, что даёт Telegram.
 *
 * Прежний `soft` был выбран под характер анимации — мягкая, тягучая отдача, —
 * но на телефоне оказался почти неразличим: это слабейший из стилей, и на
 * отметку, главное действие приложения, его не хватало.
 *
 * Одним толчком, а не очередью: очередь из двух-трёх подряд ощущается не
 * усиленным откликом, а непрерывным дребезжанием — отметка должна отзываться
 * коротким ударом, а не гудеть.
 */
export function hapticTick(): void {
  // Запасная вибрация тоже одиночная, но подлиннее прежних 26 мс: короткий
  // импульс на Android почти не чувствуется.
  impact('heavy', 45)
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
