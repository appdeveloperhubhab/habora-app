/**
 * Тексты бота на трёх языках.
 *
 * Язык берётся из настроек приложения, а если человек их ещё не открывал —
 * из настроек его Telegram: бот пишет первым, и спросить, на каком языке
 * говорить, ему негде.
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
    /*
     * Заголовок один на любое число привычек. Раньше их было два — про одну
     * и про несколько, — и во втором называлось только количество: «осталось
     * непройденных привычек: 3». Какие именно, приходилось угадывать по
     * кнопкам под сообщением. Теперь заголовок общий, а названия и расписание
     * идут списком под ним.
     */
    reminderTitle: 'Сегодня не отмечено:',
    reminderItem: (habit, when) => `• <b>${habit}</b> — ${when}`,
    remainingTitle: 'Осталось:',
    everyday: 'каждый день',
    noSchedule: 'без расписания',
    // «1 раз», «2 раза», «5 раз». Расписание бывает только от 1 до 7,
    // поэтому обходимся без разбора сотен и десятков.
    timesAWeek: (n) => `${n} ${n >= 2 && n <= 4 ? 'раза' : 'раз'} в неделю`,
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
    reminderTitle: 'Not checked off today:',
    reminderItem: (habit, when) => `• <b>${habit}</b> — ${when}`,
    remainingTitle: 'Still left:',
    everyday: 'every day',
    noSchedule: 'no schedule',
    timesAWeek: (n) => `${n}× a week`,
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
  uk: {
    welcome: (name) =>
      `Привіт, ${name}!\n\n<b>Habora — звички удвох.</b>\n\n` +
      `• Заводьте звичку й кличте друга за посиланням\n` +
      `• Відмічайтеся одним дотиком — кожен у себе\n` +
      `• Бачите позначки одне одного й тримаєте серію разом\n` +
      `• Увечері нагадаю про незроблене просто в цьому чаті\n\n` +
      `Натисніть кнопку нижче, щоб почати.`,
    open: 'Відкрити застосунок',
    reminderTitle: 'Сьогодні не відмічено:',
    reminderItem: (habit, when) => `• <b>${habit}</b> — ${when}`,
    remainingTitle: 'Залишилося:',
    everyday: 'щодня',
    noSchedule: 'без розкладу',
    // «1 раз», «2 рази», «5 разів» — три формы, как и в русском, но у единицы
    // своя, отдельная: «1 разів» звучало бы так же дико, как «1 дней».
    timesAWeek: (n) => `${n} ${n === 1 ? 'раз' : n <= 4 ? 'рази' : 'разів'} на тиждень`,
    markedOne: (habit) => `✅ <b>${habit}</b> — відмічено`,
    allDone: '✅ Усе на сьогодні виконано',
    markedToast: 'Відмічено',
    goneToast: 'Звичку не знайдено',
    unknown: 'Я вмію небагато: відкрити застосунок і нагадати про звички. Усе інше — всередині.',
    joined: (habit, host) =>
      `Ви приєдналися до звички <b>${habit}</b>${host ? ` — її веде ${host}` : ''}.\n\nВідмічайте її в себе, і побачите, як ідуть справи одне в одного.`,
    joinedAlready: (habit) => `Ви вже берете участь у звичці <b>${habit}</b>.`,
    joinGone: 'Звички за цим посиланням більше немає — можливо, її видалили.',
    someoneJoined: (name, habit) => `${name} тепер з вами у звичці <b>${habit}</b>`,
  },
}

export function texts(language) {
  if (language?.startsWith('uk')) return TEXTS.uk
  return language?.startsWith('ru') ? TEXTS.ru : TEXTS.en
}

const WEEKDAYS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
}

/**
 * Когда привычку положено выполнять: «каждый день», «Пн, Ср, Пт».
 *
 * Формулировки намеренно те же, что под названием привычки в приложении
 * (см. `scheduleLabel` в app/src/features/habits): человек читает напоминание
 * и карточку с разницей в секунду, и одно и то же расписание, названное
 * по-разному, заставило бы сверять их вместо того, чтобы просто узнать.
 *
 * Разница одна — здесь со строчной буквы: в приложении это отдельная подпись,
 * а тут продолжение строки после тире.
 */
export function scheduleLabel(schedule, language) {
  const code = language?.startsWith('uk') ? 'uk' : language?.startsWith('ru') ? 'ru' : 'en'
  const t = TEXTS[code]

  // Расписание «N раз в неделю» убрано из приложения, но у привычек,
  // заведённых до этого, оно осталось в базе — и напоминание должно
  // называть его правильно, а не показывать пустое место.
  if (schedule?.type === 'frequency') return t.timesAWeek(Number(schedule.timesPerWeek) || 1)

  const days = Array.isArray(schedule?.days) ? schedule.days : []
  if (days.length === 0) return t.noSchedule
  if (days.length === 7) return t.everyday
  return days.map((day) => WEEKDAYS[code][day]).join(', ')
}

/** Экранирование для parse_mode: HTML — иначе «<» в названии привычки сломает разметку. */
export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
