/**
 * Состав встроенного набора иконок для привычек.
 *
 * Вынесено отдельно от компонента, который их рисует: иначе горячая
 * перезагрузка в разработке перестаёт работать для файла с иконками.
 */

/** Иконка привычки хранится строкой: `ic:<id>` — из этого набора, иначе эмодзи. */
export const ICON_PREFIX = 'ic:'

export const DEFAULT_HABIT_ICON = `${ICON_PREFIX}star`

/**
 * Все иконки одним списком, без разбиения на подписанные разделы.
 *
 * Заголовки вроде «Тело и здоровье» разрывали сетку на куски и заставляли
 * читать вместо того, чтобы смотреть: иконку всё равно ищут глазами по
 * картинке, а не по названию раздела. Порядок при этом не случайный —
 * родственные иконки стоят рядом, и группы видно по самим силуэтам.
 */
export const HABIT_ICONS: string[] = [
  // Движение
  'run', 'walk', 'yoga', 'lunge', 'meditate', 'stretch',
  'swim', 'bike', 'footsteps', 'person', 'people', 'smile',
  // Спорт
  'dumbbell', 'soccer', 'tennis', 'football', 'basketball', 'baseball',
  'trophy', 'medal', 'target', 'flag', 'shoe', 'bolt',
  // Тело и здоровье
  'heart', 'lungs', 'brain', 'paw', 'cross', 'pill',
  'tooth', 'shower', 'broom', 'lotus',
  // Еда и напитки
  'cutlery', 'carrot', 'apple', 'drop', 'cup', 'juice',
  'bottle', 'wine',
  // Природа и погода
  'tree', 'flower', 'leaf', 'mountain', 'globe', 'sun',
  'sunrise', 'moon', 'snow', 'cloud', 'lightning',
  // Время и сон
  'bed', 'clock', 'timer', 'alarm', 'hourglass', 'calendar',
  // Учёба и работа
  'graduation', 'book', 'note', 'pen', 'ruler', 'math',
  'laptop', 'phone', 'briefcase', 'folder', 'tray', 'box',
  'file', 'message', 'quote',
  // Деньги
  'wallet', 'card', 'coin', 'dollar', 'cart', 'chart',
  // Творчество и отдых
  'music', 'headphones', 'mic', 'brush', 'palette', 'camera',
  'video', 'game', 'dice', 'image', 'eye', 'tap',
  // Транспорт и места
  'plane', 'car', 'sail', 'building', 'home',
  // Вещи и символы
  'trash', 'hammer', 'flask', 'layers', 'bookmark', 'send',
  'puzzle', 'gift', 'crown', 'sparkles', 'flame', 'star',
  'check', 'badge', 'shield', 'bulb', 'bell', 'lock',
  'wifi', 'search', 'gear', 'hand', 'yinyang', 'alert', 'ban',
]
