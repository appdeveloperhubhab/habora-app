/**
 * Описания допустимых запросов.
 *
 * Приложение ограничивает поля прямо в полях ввода, но это ограничение живёт
 * в браузере: запрос можно отправить и мимо приложения. Проверка на сервере —
 * единственная настоящая, всё остальное лишь помогает не ошибиться случайно.
 *
 * Fastify проверяет тело по этим описаниям до того, как обработчик его увидит,
 * и сам отвечает 400 на непрошедшее. Поэтому в обработчиках нет ни одной
 * проверки формата — только смысл.
 */

/** Цвет привычки — ровно шесть шестнадцатеричных цифр после решётки. */
const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }

/**
 * Иконка: `ic:<название>` из встроенного набора либо эмодзи с клавиатуры.
 * Длина с запасом — составные эмодзи занимают до десятка символов.
 */
const icon = { type: 'string', minLength: 1, maxLength: 64 }

const schedule = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['weekdays', 'frequency'] },
    days: {
      type: 'array',
      maxItems: 7,
      items: { type: 'integer', minimum: 0, maximum: 6 },
    },
    timesPerWeek: { type: 'integer', minimum: 1, maximum: 7 },
  },
  required: ['type'],
}

/**
 * Поля привычки. Длины совпадают с ограничениями полей ввода в приложении:
 * расхождение означало бы, что человек видит одно, а получает другое.
 */
const habitFields = {
  name: { type: 'string', minLength: 1, maxLength: 60 },
  description: { type: 'string', maxLength: 120 },
  color,
  icon,
  schedule,
  // Пустая цель приходит как null — «без цели» это её отсутствие, а не ноль.
  streakGoal: { type: ['integer', 'null'], minimum: 0, maximum: 365 },
  tinted: { type: 'boolean' },
  durationSec: { type: ['integer', 'null'], minimum: 0, maximum: 86400 },
  /*
   * Время напоминания `ЧЧ:ММ` в сутках человека; null — не напоминать.
   * Строкой, а не числом минут: в этом же виде оно приходит из поля ввода,
   * в этом же уходит в текст сообщения, и переводить туда-обратно незачем.
   */
  // Часы и минуты набором цифр, а не `\d`: в строке обратная косая съедается
  // ещё до того, как её увидит проверка, и шаблон начинает требовать букву «d».
  remindAt: { type: ['string', 'null'], pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
}

/** Дата без времени: `2026-08-08`. */
const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }

export const createHabitSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: habitFields,
    // Лишние поля отбрасываются, а не отвергаются: старое приложение на чужом
    // телефоне может прислать поле, которого сервер уже не знает, и ронять
    // из-за этого сохранение привычки незачем.
    additionalProperties: false,
  },
}

/** При правке присылают только изменённое, поэтому обязательных полей нет. */
export const updateHabitSchema = {
  body: { type: 'object', properties: habitFields, additionalProperties: false },
}

export const reorderSchema = {
  body: {
    type: 'object',
    required: ['ids'],
    properties: {
      ids: { type: 'array', maxItems: 500, items: { type: 'string', maxLength: 64 } },
    },
    additionalProperties: false,
  },
}

export const toggleEntrySchema = {
  body: {
    type: 'object',
    required: ['habitId', 'date'],
    properties: {
      habitId: { type: 'string', minLength: 1, maxLength: 64 },
      date: isoDate,
    },
    additionalProperties: false,
  },
}

export const entriesQuerySchema = {
  querystring: {
    type: 'object',
    properties: { from: isoDate, to: isoDate },
  },
}

export const habitsQuerySchema = {
  querystring: {
    type: 'object',
    properties: { today: isoDate },
  },
}

export const visitSchema = {
  body: {
    type: 'object',
    properties: {
      // Смещение часового пояса в минутах: от −12 до +14 часов.
      tzOffset: { type: 'integer', minimum: -720, maximum: 840 },
    },
    additionalProperties: false,
  },
}

/**
 * Настройки.
 *
 * Здесь, в отличие от привычки, лишние поля разрешены: приложение на Vercel и
 * сервер на Render выкладываются не одновременно, и новая настройка какое-то
 * время приходит на сервер, который о ней ещё не знает. Отвергать её значило
 * бы сломать сохранение настроек целиком на всё время выкладки.
 *
 * Известные поля при этом проверяются: подсунуть в тему или язык что попало
 * не выйдет.
 */
export const settingsSchema = {
  body: {
    type: 'object',
    properties: {
      theme: { type: 'string', enum: ['dark', 'light'] },
      lang: { type: 'string', enum: ['ru', 'en', 'uk'] },
      accentColor: color,
      cardView: { type: 'string', enum: ['week', 'month', 'year'] },
      backgroundKind: { type: 'string', enum: ['none', 'gradient'] },
      gradientFrom: color,
      gradientTo: color,
      onboarded: { type: 'boolean' },
      reminders: { type: 'boolean' },
      hintSeen: { type: 'boolean' },
      celebrated: { type: 'array', maxItems: 200, items: { type: 'string', maxLength: 64 } },
      timer: {
        type: ['object', 'null'],
        properties: {
          kind: { type: 'string', enum: ['habit'] },
          id: { type: 'string', maxLength: 64 },
          startedAt: { type: 'string', maxLength: 40 },
          durationSec: { type: 'integer', minimum: 0, maximum: 86400 },
          pausedAt: { type: ['string', 'null'], maxLength: 40 },
          pausedMs: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
}

/**
 * Время напоминания — своё у каждого участника, поэтому у него отдельный
 * маршрут и отдельное описание: в правке привычки это поле принимается от
 * создателя заодно, а здесь — от любого участника и только оно одно.
 */
export const reminderSchema = {
  body: {
    type: 'object',
    properties: {
      remindAt: { type: ['string', 'null'], pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
    },
    additionalProperties: false,
  },
}
