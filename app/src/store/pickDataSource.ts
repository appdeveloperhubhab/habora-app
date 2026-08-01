import { isTelegram } from '../lib/telegram'
import { ApiDataSource } from './api'
import type { DataSource } from './datasource'
import { LocalDataSource } from './local'

/**
 * Выбирает, где хранить данные.
 *
 * На сервере — только когда приложение действительно открыто внутри Telegram
 * и задан адрес API: вне Telegram нет подписи `initData`, и сервер такой
 * запрос отклонит. В остальных случаях (браузер, разработка) работает
 * локальное хранилище, как раньше.
 */
export function pickDataSource(): DataSource {
  const apiUrl = import.meta.env.VITE_API_URL

  if (isTelegram && apiUrl) return new ApiDataSource(apiUrl)
  return new LocalDataSource()
}
