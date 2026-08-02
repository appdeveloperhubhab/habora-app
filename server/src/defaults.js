/**
 * Значения настроек по умолчанию.
 *
 * Дублируют `app/src/store/datasource.ts` — сервер и клиент должны понимать
 * настройки одинаково. При добавлении новой настройки правьте оба файла.
 */
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  lang: 'ru',
  accentColor: '#6c5ce7',
  cardView: 'week',
  backgroundKind: 'none',
  gradientFrom: '#2b1055',
  gradientTo: '#7597de',
  onboarded: false,
  celebrated: [],
  hintSeen: false,
  timer: null,
}
