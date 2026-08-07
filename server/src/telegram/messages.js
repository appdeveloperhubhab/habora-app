/**
 * Тексты бота на двух языках.
 *
 * Язык берётся из настроек Telegram самого человека: бот пишет первым, и
 * спросить, на каком языке говорить, ему негде.
 */

const TEXTS = {
  ru: {
    /*
     * Приветствие идёт подписью под картинкой, поэтому оно короткое и
     * списком: подпись Telegram ограничивает 1024 символами, а длинную
     * простыню под фотографией всё равно никто не читает.
     *
     * Совместные привычки стоят первым пунктом намеренно. Это главное отличие
     * приложения, а раньше о нём в приветствии не было ни слова — человек
     * узнавал о такой возможности, только добравшись до вкладки «Друзья».
     */
    welcome: (name) =>
      `Привет, ${name}!\n\n<b>Habora — привычки вдвоём.</b>\n\n` +
      `• Заводите привычку и зовите друга по ссылке\n` +
      `• Отмечайтесь одним касанием — каждый у себя\n` +
      `• Видите отметки друг друга и держите серию вместе\n` +
      `• Вечером напомню о несделанном прямо в этом чате\n\n` +
      `Нажмите кнопку ниже, чтобы начать.`,
    open: 'Открыть приложение',
    reminderOne: (habit) => `Сегодня осталась одна привычка: <b>${habit}</b>`,
    reminderMany: (count) => `Сегодня осталось непройденных привычек: <b>${count}</b>`,
    markedOne: (habit) => `✅ <b>${habit}</b> — отмечено`,
    allDone: '✅ Всё на сегодня выполнено',
    markedToast: 'Отмечено',
    goneToast: 'Привычка не найдена',
    unknown: 'Я умею немногое: открыть приложение и напомнить о привычках. Всё остальное — внутри.',
    /*
     * Имя приходит из Telegram как есть: склонять его нельзя, и род по нему
     * не угадывается. Поэтому имя всюду стоит в именительном падеже, а
     * сказуемые подобраны так, чтобы подойти любому: «ведёт», а не «завёл»,
     * «теперь с вами», а не «присоединился».
     */
    joined: (habit, host) =>
      `Вы присоединились к привычке <b>${habit}</b>${host ? ` — её ведёт ${host}` : ''}.\n\nОтмечайте её у себя, и увидите, как идут дела друг у друга.`,
    joinedAlready: (habit) => `Вы уже участвуете в привычке <b>${habit}</b>.`,
    joinGone: 'Привычки по этой ссылке больше нет — возможно, её удалили.',
    someoneJoined: (name, habit) => `${name} теперь с вами в привычке <b>${habit}</b>`,
  },
  en: {
    welcome: (name) =>
      `Hi, ${name}!\n\n<b>Habora — habits you keep together.</b>\n\n` +
      `• Start a habit and invite a friend by link\n` +
      `• Check off with one tap — each on your own side\n` +
      `• See each other's marks and keep the streak together\n` +
      `• In the evening I will remind you here about what is left\n\n` +
      `Tap the button below to start.`,
    open: 'Open app',
    reminderOne: (habit) => `One habit left today: <b>${habit}</b>`,
    reminderMany: (count) => `Habits left today: <b>${count}</b>`,
    markedOne: (habit) => `✅ <b>${habit}</b> — done`,
    allDone: '✅ Everything done for today',
    markedToast: 'Done',
    goneToast: 'Habit not found',
    unknown: 'I can do little: open the app and remind you about habits. Everything else lives inside.',
    joined: (habit, host) =>
      `You joined <b>${habit}</b>${host ? ` together with ${host}` : ''}.\n\nMark it off on your side — and you will both see how it goes.`,
    joinedAlready: (habit) => `You are already in <b>${habit}</b>.`,
    joinGone: 'That habit is gone — it may have been deleted.',
    someoneJoined: (name, habit) => `${name} joined your habit <b>${habit}</b>`,
  },
}

export function texts(language) {
  return language?.startsWith('ru') ? TEXTS.ru : TEXTS.en
}

/** Экранирование для parse_mode: HTML — иначе «<» в названии привычки сломает разметку. */
export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
