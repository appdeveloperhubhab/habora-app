import { useState } from 'react'
import { personColor } from '../lib/personColor'
import styles from './Avatar.module.css'

/**
 * Аватарка человека из Telegram.
 *
 * Фото есть не у всех, а ссылка на него живёт недолго и однажды перестаёт
 * открываться. Поэтому на месте фото всегда лежит подложка с первой буквой
 * имени: не загрузилось — человек всё равно узнаётся, а дыры в списке нет.
 *
 * Цвет подложки выводится из имени, а не случайный: у одного и того же
 * человека он всегда один, и по нему тоже узнаёшь, кто это.
 */
export function Avatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string
  photoUrl?: string | null
  size?: number
}) {
  const [broken, setBroken] = useState(false)

  const letter = [...name.trim()][0]?.toUpperCase() ?? '?'

  return (
    <span
      className={styles.avatar}
      style={
        {
          width: size,
          height: size,
          fontSize: Math.round(size * 0.42),
          '--tone': personColor(name),
        } as React.CSSProperties
      }
    >
      {letter}
      {photoUrl && !broken && (
        <img className={styles.photo} src={photoUrl} alt="" onError={() => setBroken(true)} />
      )}
    </span>
  )
}
