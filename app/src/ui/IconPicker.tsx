import { useRef } from 'react'
import type { Lang } from '../types'
import { hapticSelect } from '../lib/haptics'
import { HabitIcon } from './habitIcons'
import { ICON_CATEGORIES, ICON_PREFIX } from './habitIconSet'
import styles from './IconPicker.module.css'

/**
 * Выбор иконки привычки из двух источников, как требует ТЗ.
 *
 * Первый — поле ввода, открывающее системную клавиатуру эмодзи: пользователь
 * берёт любой смайлик из тысяч доступных, наш набор его не ограничивает.
 * Второй — встроенный набор линейных иконок, оформленных под остальной
 * интерфейс, а не цветных эмодзи.
 */

interface Props {
  value: string
  color: string
  lang: Lang
  onChange(icon: string): void
  labels: { pickEmoji: string; emojiHint: string; iconsHint: string }
}

/**
 * Оставляет в строке ровно один символ эмодзи.
 *
 * `Intl.Segmenter` нужен, потому что многие эмодзи состоят из нескольких кодовых
 * точек (флаги, семьи, символы с модификатором тона кожи), и обычное `slice`
 * разрезало бы их посередине, превращая в мусор.
 */
function firstGrapheme(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const first = segmenter.segment(trimmed)[Symbol.iterator]().next()
    return first.done ? '' : first.value.segment
  }
  return [...trimmed][0] ?? ''
}

export function IconPicker({ value, color, lang, onChange, labels }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isEmoji = value !== '' && !value.startsWith(ICON_PREFIX)

  return (
    <div className={styles.wrap} style={{ '--habit': color } as React.CSSProperties}>
      <button
        type="button"
        className={isEmoji ? `${styles.emojiField} ${styles.selected}` : styles.emojiField}
        onClick={() => inputRef.current?.focus()}
      >
        <span className={styles.emojiPreview}>{isEmoji ? value : '🙂'}</span>
        <span className={styles.emojiText}>
          <span className={styles.emojiTitle}>{labels.pickEmoji}</span>
          <span className={styles.emojiHint}>{labels.emojiHint}</span>
        </span>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          value={isEmoji ? value : ''}
          onChange={(e) => {
            const emoji = firstGrapheme(e.target.value)
            if (emoji) onChange(emoji)
          }}
          inputMode="text"
          aria-label={labels.pickEmoji}
        />
      </button>

      <p className={styles.hint}>{labels.iconsHint}</p>

      {ICON_CATEGORIES.map((category) => (
        <section key={category.id} className={styles.category}>
          <h4 className={styles.label}>{category.label[lang]}</h4>
          <div className={styles.grid}>
            {category.icons.map((id) => {
              const icon = `${ICON_PREFIX}${id}`
              return (
                <button
                  key={id}
                  type="button"
                  className={icon === value ? `${styles.icon} ${styles.iconSelected}` : styles.icon}
                  onClick={() => {
                    hapticSelect()
                    onChange(icon)
                  }}
                  aria-pressed={icon === value}
                  aria-label={id}
                >
                  <HabitIcon icon={icon} size={24} />
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
