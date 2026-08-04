import Fastify from 'fastify'
import cors from '@fastify/cors'
import { verifyInitData } from './telegramAuth.js'
import { habitRoutes } from './routes/habits.js'
import { settingsRoutes } from './routes/settings.js'
import { userRoutes } from './routes/users.js'
import { friendRoutes } from './routes/friends.js'
import { botRoutes } from './routes/bot.js'
import { setWebhook, webhookSecret } from './telegram/api.js'

const app = Fastify({ logger: true })

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
