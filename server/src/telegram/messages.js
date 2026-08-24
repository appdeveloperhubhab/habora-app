/**
 * Тексты бота на трёх языках.
 *
 * Язык берётся из настроек приложения, а если человек их ещё не открывал —
 * из настроек его Telegram: бот пишет первым, и спросить, на каком языке
 * говорить, ему негде.
 *
 * Уведомления построены по одному правилу: первой строкой, полужирным, — о ком
 * или о чём речь, второй — что произошло. В ленте чатов Telegram показывает
 * начало сообщения, и по одной строке уже понятно, чьё оно и о какой привычке,
 * — открывать не обязательно. Прежние тексты начинались со значка и служебных
 * слов («Пора:», «✅ Аня отмечает…»), и в списке чатов от них не было толку.
 *
 * Значков в начале нет намеренно: у бота своя аватарка, и ещё один рисунок
 * перед каждым сообщением только шумит.
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
     * Вечернее — единственное, где в первой строке не название привычки:
     * их там несколько, и любая на месте заголовка обманывала бы, обещая
     * сообщение про неё одну.
     */
    reminderTitle: '<b>Не отмечено сегодня</b>',
    reminderItem: (habit, when) => `• ${habit} — ${when}`,
    remainingTitle: 'Осталось:',
    timedReminder: (habit) => `<b>${habit}</b>\nПора выполнить привычку`,
    /*
     * Те же сообщения для привычки с нормой на день. Счётчик в них — не
     * украшение: «пора выпить воду» в третий раз за день без «2 из 3»
     * читается как сбой рассылки.
     */
    reminderItemOf: (habit, done, target) => `• ${habit} — ${done} из ${target}`,
    timedReminderOf: (habit, done, target) =>
      `<b>${habit}</b>\nПора выполнить — ${done} из ${target}`,
    markedOf: (habit, done, target) => `<b>${habit}</b>\nВыполнено ${done} из ${target}`,
    markedToastOf: (done, target) => `${done} из ${target}`,
    markButton: 'Отметить',
    everyday: 'каждый день',
    noSchedule: 'без расписания',
    // «1 раз», «2 раза», «5 раз». Расписание бывает только от 1 до 7,
    // поэтому обходимся без разбора сотен и десятков.
    timesAWeek: (n) => `${n} ${n >= 2 && n <= 4 ? 'раза' : 'раз'} в неделю`,
    markedOne: (habit) => `<b>${habit}</b>\nВыполнено`,
    allDone: 'Всё на сегодня выполнено',
    markedToast: 'Отмечено',
    goneToast: 'Привычка не найдена',
    unknown: 'Я умею немногое: открыть приложение и напомнить о привычках. Всё остальное — внутри.',
    /*
     * Имя приходит из Telegram как есть: склонять его нельзя, и род по нему
     * не угадывается. Поэтому имя всюду стоит в именительном падеже, а
     * сказуемые подобраны так, чтобы подойти любому: «выполняет», а не
     * «выполнил», «ведёт», а не «завёл».
     */
    joined: (habit, host) =>
      `<b>${habit}</b>\nВы присоединились к привычке${host ? ` — её ведёт ${host}` : ''}`,
    joinedAlready: (habit) => `<b>${habit}</b>\nВы уже участвуете в этой привычке`,
    joinGone: 'Привычки по этой ссылке больше нет — возможно, её удалили.',
    someoneJoined: (name, habit) => `<b>${name}</b>\nтеперь ведёт привычку ${habit} вместе с вами`,
    partnerMarked: (name, habit) => `<b>${name}</b>\nвыполняет привычку ${habit}`,
    markIt: 'Отметить',
    habitDeleted: (name, habit) =>
      `<b>${name}</b>\nудаляет общую привычку ${habit}\n\n` +
      `Она исчезла у всех участников вместе с историей отметок.`,
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
    reminderTitle: '<b>Not checked off today</b>',
    reminderItem: (habit, when) => `• ${habit} — ${when}`,
    remainingTitle: 'Still left:',
    timedReminder: (habit) => `<b>${habit}</b>\nTime to do this habit`,
    reminderItemOf: (habit, done, target) => `• ${habit} — ${done} of ${target}`,
    timedReminderOf: (habit, done, target) =>
      `<b>${habit}</b>\nTime to do this — ${done} of ${target}`,
    markedOf: (habit, done, target) => `<b>${habit}</b>\nDone ${done} of ${target}`,
    markedToastOf: (done, target) => `${done} of ${target}`,
    markButton: 'Mark done',
    everyday: 'every day',
    noSchedule: 'no schedule',
    timesAWeek: (n) => `${n}× a week`,
    markedOne: (habit) => `<b>${habit}</b>\nDone`,
    allDone: 'Everything done for today',
    markedToast: 'Done',
    goneToast: 'Habit not found',
    unknown: 'I can do little: open the app and remind you about habits. Everything else lives inside.',
    joined: (habit, host) =>
      `<b>${habit}</b>\nYou joined this habit${host ? ` — ${host} keeps it too` : ''}`,
    joinedAlready: (habit) => `<b>${habit}</b>\nYou are already in this habit`,
    joinGone: 'That habit is gone — it may have been deleted.',
    someoneJoined: (name, habit) => `<b>${name}</b>\nnow keeps the habit ${habit} with you`,
    partnerMarked: (name, habit) => `<b>${name}</b>\ndid the habit ${habit}`,
    markIt: 'Check off',
    habitDeleted: (name, habit) =>
      `<b>${name}</b>\ndeleted the shared habit ${habit}\n\n` +
      `It is gone for everyone, along with the check-in history.`,
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
    reminderTitle: '<b>Не відмічено сьогодні</b>',
    reminderItem: (habit, when) => `• ${habit} — ${when}`,
    remainingTitle: 'Залишилося:',
    timedReminder: (habit) => `<b>${habit}</b>\nЧас виконати звичку`,
    reminderItemOf: (habit, done, target) => `• ${habit} — ${done} з ${target}`,
    timedReminderOf: (habit, done, target) =>
      `<b>${habit}</b>\nЧас виконати — ${done} з ${target}`,
    markedOf: (habit, done, target) => `<b>${habit}</b>\nВиконано ${done} з ${target}`,
    markedToastOf: (done, target) => `${done} з ${target}`,
    markButton: 'Відмітити',
    everyday: 'щодня',
    noSchedule: 'без розкладу',
    // «1 раз», «2 рази», «5 разів» — три формы, как и в русском, но у единицы
    // своя, отдельная: «1 разів» звучало бы так же дико, как «1 дней».
    timesAWeek: (n) => `${n} ${n === 1 ? 'раз' : n <= 4 ? 'рази' : 'разів'} на тиждень`,
    markedOne: (habit) => `<b>${habit}</b>\nВиконано`,
    allDone: 'Усе на сьогодні виконано',
    markedToast: 'Відмічено',
    goneToast: 'Звичку не знайдено',
    unknown: 'Я вмію небагато: відкрити застосунок і нагадати про звички. Усе інше — всередині.',
    joined: (habit, host) =>
      `<b>${habit}</b>\nВи приєдналися до звички${host ? ` — її веде ${host}` : ''}`,
    joinedAlready: (habit) => `<b>${habit}</b>\nВи вже берете участь у цій звичці`,
    joinGone: 'Звички за цим посиланням більше немає — можливо, її видалили.',
    someoneJoined: (name, habit) => `<b>${name}</b>\nтепер веде звичку ${habit} разом з вами`,
    partnerMarked: (name, habit) => `<b>${name}</b>\nвиконує звичку ${habit}`,
    markIt: 'Відмітити',
    habitDeleted: (name, habit) =>
      `<b>${name}</b>\nвидаляє спільну звичку ${habit}\n\n` +
      `Вона зникла в усіх учасників разом з історією позначок.`,
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
