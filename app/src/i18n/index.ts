import type { Lang } from '../types'
import { ru, type Dict } from './ru'
import { en } from './en'
import { uk } from './uk'

const DICTS: Record<Lang, Dict> = { ru, en, uk }

export function dict(lang: Lang): Dict {
  return DICTS[lang]
}

export type { Dict }
