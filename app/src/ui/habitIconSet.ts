/**
 * Состав встроенного набора иконок для привычек.
 *
 * Вынесено отдельно от компонента, который их рисует: иначе горячая
 * перезагрузка в разработке перестаёт работать для файла с иконками.
 */

/** Иконка привычки хранится строкой: `ic:<id>` — из этого набора, иначе эмодзи. */
export const ICON_PREFIX = 'ic:'

export const DEFAULT_HABIT_ICON = `${ICON_PREFIX}star`

export interface IconCategory {
  id: string
  label: { ru: string; en: string }
  icons: string[]
}

export const ICON_CATEGORIES: IconCategory[] = [
  {
    id: 'body',
    label: { ru: 'Тело и здоровье', en: 'Body & health' },
    icons: ['drop', 'heart', 'dumbbell', 'bike', 'shoe', 'pill', 'apple', 'carrot', 'cup', 'bottle', 'tooth', 'lotus'],
  },
  {
    id: 'time',
    label: { ru: 'Время и сон', en: 'Time & sleep' },
    icons: ['bed', 'clock', 'alarm', 'calendar', 'hourglass'],
  },
  {
    id: 'work',
    label: { ru: 'Учёба и работа', en: 'Study & work' },
    icons: ['book', 'note', 'pen', 'laptop', 'phone', 'message', 'chart', 'wallet', 'coin', 'target', 'trophy', 'medal'],
  },
  {
    id: 'fun',
    label: { ru: 'Творчество и отдых', en: 'Creativity & leisure' },
    icons: ['music', 'headphones', 'mic', 'brush', 'palette', 'camera', 'game', 'plane', 'globe'],
  },
  {
    id: 'world',
    label: { ru: 'Природа и дом', en: 'Nature & home' },
    icons: ['sun', 'moon', 'cloud', 'leaf', 'tree', 'flower', 'mountain', 'home', 'broom', 'lightning', 'shield', 'gift', 'star', 'check'],
  },
]
