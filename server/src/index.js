import Fastify from 'fastify'
import cors from '@fastify/cors'
import { verifyInitData } from './telegramAuth.js'
import { habitRoutes } from './routes/habits.js'
import { taskRoutes } from './routes/tasks.js'

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
})

app.get('/health', async () => ({ ok: true }))

await app.register(habitRoutes)
await app.register(taskRoutes)

const port = Number(process.env.PORT ?? 3000)
// Слушаем все интерфейсы: внутри контейнера хостинга localhost недоступен снаружи.
await app.listen({ port, host: '0.0.0.0' })
