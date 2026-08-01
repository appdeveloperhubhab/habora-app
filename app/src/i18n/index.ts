import type { Lang } from '../types'
import { ru, type Dict } from './ru'
import { en } from './en'

const DICTS: Record<Lang, Dict> = { ru, en }

export function dict(lang: Lang): Dict {
  return DICTS[lang]
}

export type { Dict }
