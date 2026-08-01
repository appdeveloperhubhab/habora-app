import type { Lang } from '../../types'
import { ICON_PREFIX } from '../../ui/habitIconSet'

/**
 * Готовые привычки для первого запуска.
 *
 * Набор намеренно короткий и бытовой: человек, впервые открывший трекер,
 * редко знает, что именно хочет отслеживать, и длинный список только
 * усложняет выбор. Здесь то, с чего начинают чаще всего.
 *
 * Иконки берутся из встроенного набора, а не из эмодзи: цветные системные
 * смайлики выбиваются из строгого линейного стиля интерфейса. Свой эмодзи
 * пользователь всегда может поставить позже, в редакторе привычки.
 *
 * Цвета подобраны так, чтобы соседние чипы не сливались: соседи по списку
 * всегда из разных семейств палитры.
 */

export interface StarterHabit {
  id: string
  icon: string
  name: Record<Lang, string>
  color: string
}

export const STARTER_HABITS: StarterHabit[] = [
  { id: 'water', icon: `${ICON_PREFIX}drop`, name: { ru: 'Пить воду', en: 'Drink water' }, color: '#38BDF8' },
  { id: 'read', icon: `${ICON_PREFIX}book`, name: { ru: 'Читать', en: 'Read' }, color: '#FF9500' },
  { id: 'sport', icon: `${ICON_PREFIX}dumbbell`, name: { ru: 'Спорт', en: 'Exercise' }, color: '#34C759' },
  { id: 'sleep', icon: `${ICON_PREFIX}bed`, name: { ru: 'Ложиться вовремя', en: 'Sleep on time' }, color: '#8B5CF6' },
  { id: 'meditate', icon: `${ICON_PREFIX}lotus`, name: { ru: 'Медитация', en: 'Meditate' }, color: '#06B6D4' },
  { id: 'english', icon: `${ICON_PREFIX}message`, name: { ru: 'Английский', en: 'Language practice' }, color: '#FF6FA5' },
  { id: 'walk', icon: `${ICON_PREFIX}shoe`, name: { ru: 'Прогулка', en: 'Walk' }, color: '#A3E635' },
  { id: 'vitamins', icon: `${ICON_PREFIX}pill`, name: { ru: 'Витамины', en: 'Vitamins' }, color: '#FFD60A' },
  { id: 'wakeup', icon: `${ICON_PREFIX}alarm`, name: { ru: 'Ранний подъём', en: 'Early wake-up' }, color: '#FFA524' },
  { id: 'nosugar', icon: `${ICON_PREFIX}apple`, name: { ru: 'Без сладкого', en: 'No sweets' }, color: '#C2185B' },
]
