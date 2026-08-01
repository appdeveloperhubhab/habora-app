import type { ActiveTimer } from '../types'

/**
 * Расчёты для таймера.
 *
 * Вся математика идёт от момента старта, а не от накопленного остатка.
 * Это принципиально: браузер замораживает счётчики в неактивных вкладках,
 * поэтому таймер, который уменьшал бы остаток по тику, вставал бы каждый раз,
 * когда приложение свернули или заблокировали экран. От времени старта остаток
 * пересчитывается при любом возвращении и всегда верен.
 */

export function totalMs(timer: ActiveTimer): number {
  return timer.durationSec * 1000
}

/** Сколько прошло с учётом всех пауз. */
export function elapsedMs(timer: ActiveTimer, now: number = Date.now()): number {
  const started = new Date(timer.startedAt).getTime()
  // На паузе время замирает: считаем до момента, когда её поставили.
  const until = timer.pausedAt ? new Date(timer.pausedAt).getTime() : now
  return Math.max(0, until - started - timer.pausedMs)
}

/** Сколько осталось до конца, в миллисекундах. */
export function remainingMs(timer: ActiveTimer, now: number = Date.now()): number {
  return Math.max(0, totalMs(timer) - elapsedMs(timer, now))
}

/** Заполнение от 0 до 1 — для кольца прогресса. */
export function progress(timer: ActiveTimer, now: number = Date.now()): number {
  const total = totalMs(timer)
  if (total === 0) return 1
  return Math.min(1, elapsedMs(timer, now) / total)
}

export function isFinished(timer: ActiveTimer, now: number = Date.now()): boolean {
  return remainingMs(timer, now) === 0
}

/** Остаток в виде «12:05». */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Длительность словами: «10 мин», «40 сек», «1 мин 30 сек». */
export function formatDuration(totalSec: number, minLabel: string, secLabel: string): string {
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  if (minutes === 0) return `${seconds} ${secLabel}`
  if (seconds === 0) return `${minutes} ${minLabel}`
  return `${minutes} ${minLabel} ${seconds} ${secLabel}`
}

export function startTimer(kind: ActiveTimer['kind'], id: string, durationSec: number): ActiveTimer {
  return {
    kind,
    id,
    durationSec,
    startedAt: new Date().toISOString(),
    pausedAt: null,
    pausedMs: 0,
  }
}

export function pauseTimer(timer: ActiveTimer): ActiveTimer {
  if (timer.pausedAt) return timer
  return { ...timer, pausedAt: new Date().toISOString() }
}

export function resumeTimer(timer: ActiveTimer): ActiveTimer {
  if (!timer.pausedAt) return timer
  // Время, проведённое на паузе, добавляется к общему простою и дальше
  // просто вычитается из прошедшего.
  const paused = Date.now() - new Date(timer.pausedAt).getTime()
  return { ...timer, pausedAt: null, pausedMs: timer.pausedMs + paused }
}
