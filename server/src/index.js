import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { verifyInitData } from './telegramAuth.js'
import { isBlocked } from './db.js'
import { habitRoutes } from './routes/habits.js'
import { settingsRoutes } from './routes/settings.js'
import { userRoutes } from './routes/users.js'
import { friendRoutes } from './routes/friends.js'
import { botRoutes } from './routes/bot.js'
import { setWebhook, webhookSecret } from './telegram/api.js'

const app = Fastify({
  logger: true,
  /*
   * Хостинг стоит за своим прокси, и настоящий адрес посетителя приходит в
   * заголовке. Без этого все запросы выглядели бы пришедшими с одного адреса —
   * адреса прокси, — и ограничение частоты ниже считало бы всех за одного:
   * один торопливый посетитель перекрыл бы доступ остальным.
   */
  trustProxy: true,
  /*
   * Гигабайт по умолчанию этому приложению не нужен: самое большое, что оно
   * присылает, — настройки на пару килобайт. Меньший предел отсекает попытки
   * забить базу длинными строками ещё до разбора тела запроса.
   */
  bodyLimit: 64 * 1024,
  /*
   * Fastify по умолчанию заворачивает одиночное значение в список, когда
   * описание ждёт список: это удобно для адресной строки, где `?id=1&id=2`
   * приходит то одним значением, то несколькими. Но в теле запроса от этого
   * строка вместо списка проходила проверку как список из одной строки —
   * то есть проверка списка не проверяла ничего.
   */
  ajv: { customOptions: { coerceTypes: true } },
})

/**
 * Ограничение частоты запросов.
 *
 * Главная настоящая угроза этому приложению — не кража данных, а поток
 * запросов: сервер на бесплатном тарифе ляжет, а облачная база упрётся в свой
 * лимит. Красть тут особо нечего, а вот положить — легко.
 *
 * Двести запросов в минуту с адреса заведомо больше обычного: при открытии
 * приложение делает четыре, дальше по одному на действие. Настоящий человек
 * этого предела не заметит.
 *
 * Маршруты бота исключены: к ним обращается не человек, а Telegram и служба
 * будильника, у них свои секреты, и общая очередь им ни к чему.
 */
await app.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
  allowList: (request) => request.url.startsWith('/bot/') || request.url === '/health',
  // Код ответа обязан быть в самом объекте: без него Fastify не узнаёт в нём
  // ошибку и отвечает пятисоткой — то есть «сломался сервер» вместо
  // «не так часто».
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Слишком много запросов, попробуйте через ${context.after}`,
  }),
})

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
})

/**
 * Проверка подписи перед каждым запросом к API.
 *
 * Клиент присылает `initData` Telegram в заголовке. Если подпись верна —
 * кладём в запрос `userId`, и дальше все обработчики работают только с
 * данными этого пользователя. Никакой другой авторизации нет и не нужно:
 * пароли не заводятся, аккаунт — это аккаунт Telegram.
 */
app.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/api/')) return

  const result = verifyInitData(request.headers['x-telegram-init-data'], process.env.BOT_TOKEN)
  if (!result.ok) {
    return reply.code(401).send({ error: 'Не удалось подтвердить вход', reason: result.reason })
  }

  /*
   * Закрытый доступ. Проверка стоит сразу после подписи и до всех обработчиков:
   * иначе запирать пришлось бы каждый маршрут по отдельности, и забытый
   * означал бы дыру.
   *
   * Вторая дверь — сам бот, в routes/bot.js: если запереть только эту,
   * напоминания продолжали бы приходить как ни в чём не бывало.
   */
  if (await isBlocked(result.userId)) {
    return reply.code(403).send({ error: 'Доступ закрыт' })
  }

  request.userId = result.userId
  request.telegramUser = result.user
})

app.get('/health', async () => ({ ok: true }))

await app.register(habitRoutes)
await app.register(settingsRoutes)
await app.register(userRoutes)
await app.register(friendRoutes)
await app.register(botRoutes)

const port = Number(process.env.PORT ?? 3000)
// Слушаем все интерфейсы: внутри контейнера хостинга localhost недоступен снаружи.
await app.listen({ port, host: '0.0.0.0' })

/*
 * Подписка на события Telegram — при каждом запуске.
 *
 * Бесплатный хостинг засыпает и поднимается заново по первому запросу, адрес
 * при этом может смениться. Разовая настройка руками однажды указала бы в
 * никуда, а этот вызов сам возвращает всё на место; повторный с тем же адресом
 * Telegram просто принимает.
 */
const publicUrl = process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL
if (publicUrl && process.env.BOT_TOKEN) {
  const base = publicUrl.replace(/\/$/, '')
  const secret = webhookSecret(process.env.BOT_TOKEN)

  const result = await setWebhook(`${base}/bot/webhook`, secret)
  app.log.info({ result }, 'подписка на события Telegram')

  // Адрес будильника выводится из токена бота, и подсмотреть его больше негде:
  // в журнал он печатается один раз при запуске, чтобы вставить в сервис,
  // который будет дёргать сервер по расписанию.
  app.log.info(`Адрес для будильника рассылки: ${base}/bot/tick/${secret}`)
}
