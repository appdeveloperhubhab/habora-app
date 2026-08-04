import type { CSSProperties, ReactNode } from 'react'

/**
 * Линейные иконки интерфейса в едином стиле: одна сетка 24×24, одна толщина
 * штриха, скруглённые концы. Цветные эмодзи здесь намеренно не используются —
 * их выбирает пользователь для своих привычек, а сам интерфейс остаётся строгим.
 */

export type IconName =
  | 'dots'
  | 'plus'
  | 'minus'
  | 'check'
  | 'close'
  | 'back'
  | 'pencil'
  | 'settings'
  | 'search'
  | 'flame'
  | 'play'
  | 'habits'
  | 'friends'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chart'
  | 'viewCompact'
  | 'viewWeek'
  | 'viewMonth'
  | 'viewTable'

const PATHS: Record<IconName, ReactNode> = {
  dots: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronRight: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  pencil: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3.4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1.1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  flame: (
    <>
      <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.6 2-4.7 0 1.6.8 2.6 1.7 2.6.9 0 1.5-.9 1.3-2.4-.2-1.6-.6-3-.0-4.5z" />
    </>
  ),
  habits: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2.2" />
    </>
  ),
  /* Двое: один ближе и крупнее, второй чуть позади — так пара читается
     людьми, а не двумя одинаковыми кружками. */
  friends: (
    <>
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0" />
      <path d="M16.5 5.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.4a6 6 0 0 1 2.5 5.1" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15.5v-3M12.5 15.5v-7M17 15.5v-5" />
    </>
  ),
  viewCompact: (
    <>
      <rect x="3.5" y="6" width="17" height="4.5" rx="2.25" />
      <rect x="3.5" y="13.5" width="17" height="4.5" rx="2.25" />
    </>
  ),
  viewWeek: (
    <>
      <rect x="3.5" y="4.5" width="17" height="6.5" rx="2.5" />
      <rect x="3.5" y="13" width="17" height="6.5" rx="2.5" />
      <path d="M7 8h10" />
    </>
  ),
  viewMonth: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" />
    </>
  ),
  viewTable: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15" />
    </>
  ),
}

interface Props {
  name: IconName
  size?: number
  /** Толщина штриха; у мелких иконок имеет смысл делать тоньше. */
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 24, strokeWidth = 1.8, className, style }: Props) {
  const filled = name === 'dots' || name === 'flame' || name === 'play'

  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
