import type { Lang } from '../types'

/**
 * Выбор формы множественного числа.
 *
 * Русскому нужны три формы (1 день, 2 дня, 5 дней), английскому — две.
 * Без этого счётчики читаются как машинный перевод: «1 дней», «2 день».
 */
export function plural(n: number, lang: Lang, forms: [string, string, string]): string {
  if (lang !== 'ru') return n === 1 ? forms[0] : forms[2]

  const lastTwo = Math.abs(n) % 100
  const last = Math.abs(n) % 10
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}
