/**
 * Тексты бота на двух языках.
 *
 * Язык берётся из настроек Telegram самого человека: бот пишет первым, и
 * спросить, на каком языке говорить, ему негде.
 */

const TEXTS = {
  ru: {
    welcome: (name) =>
      `Привет, ${name}!\n\nHabora — трекер привычек и задач. Отмечайте выполнение одним касанием, следите за серией и смотрите, как заполняется ваш год.\n\nНажмите кнопку ниже, чтобы начать.`,
    open: 'Открыть приложение',
    reminderOne: (habit) => `Сегодня осталась одна привычка: <b>${habit}</b>`,
    reminderMany: (count) => `Сегодня осталось непройденных привычек: <b>${count}</b>`,
    markedOne: (habit) => `✅ <b>${habit}</b> — отмечено`,
    allDone: '✅ Всё на сегодня выполнено',
    markedToast: 'Отмечено',
    goneToast: 'Привычка не найдена',
    unknown: 'Я умею немногое: открыть приложение и напомнить о привычках. Всё остальное — внутри.',
  },
  en: {
    welcome: (name) =>
      `Hi, ${name}!\n\nHabora is a habit and task tracker. Mark things done with a single tap, keep your streak alive and watch your year fill up.\n\nTap the button below to start.`,
    open: 'Open app',
    reminderOne: (habit) => `One habit left today: <b>${habit}</b>`,
    reminderMany: (count) => `Habits left today: <b>${count}</b>`,
    markedOne: (habit) => `✅ <b>${habit}</b> — done`,
    allDone: '✅ Everything done for today',
    markedToast: 'Done',
    goneToast: 'Habit not found',
    unknown: 'I can do little: open the app and remind you about habits. Everything else lives inside.',
  },
}

export function texts(language) {
  return language?.startsWith('ru') ? TEXTS.ru : TEXTS.en
}

/** Экранирование для parse_mode: HTML — иначе «<» в названии привычки сломает разметку. */
export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
