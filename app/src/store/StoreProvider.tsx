import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Entry, Friend, Habit, HabitInput, IsoDate, Settings } from '../types'
import { telegramLang } from '../lib/telegram'
import { detectMilestone, type Milestone } from '../lib/milestones'
import { DEFAULT_SETTINGS, type DataSource, type MarkAction } from './datasource'
import { pickDataSource } from './pickDataSource'
import { AccessDenied } from './api'
import { clearSnapshot, readSnapshot, writeSnapshot } from './snapshot'
import { StoreContext, type StoreValue } from './context'

/**
 * Единое состояние приложения поверх `DataSource`.
 *
 * Все изменения применяются оптимистично: интерфейс обновляется сразу, запись
 * в хранилище идёт следом. Это принципиально для кнопки отметки — по ТЗ отклик
 * должен быть мгновенным, ждать ответа хранилища нельзя.
 */

function entryKey(habitId: string, date: IsoDate): string {
  return `${habitId}|${date}`
}

interface Props {
  children: ReactNode
  /** Явная подмена хранилища; обычно не нужна — выбор делает `pickDataSource`. */
  source?: DataSource
}

export function StoreProvider({ children, source }: Props) {
  const dataSource = useRef(source ?? pickDataSource()).current

  /*
   * Данные с прошлого запуска. Читаются один раз, до первой отрисовки, и
   * подставляются как начальное состояние — поэтому список привычек виден
   * сразу, ещё до того как сервер ответит. Сервер спрашивается следом, и его
   * ответ снимок заменяет.
   */
  const cached = useRef(dataSource.remote ? readSnapshot() : null).current

  const [ready, setReady] = useState(cached !== null)
  /**
   * Сорвалась ли загрузка. Бесплатный сервер засыпает без посетителей и
   * просыпается до полуминуты — всё это время он не отвечает вовсе. Молчащий
   * чёрный экран человек читает как поломку, поэтому неудачу надо показать
   * и дать возможность повторить.
   */
  const [failed, setFailed] = useState(false)
  /**
   * Закрыт ли доступ этому аккаунту. Отдельно от неудачи: та временная, а
   * этот отказ — решение владельца бота, и «Повторить» его не изменит.
   */
  const [denied, setDenied] = useState(false)
  /** Счётчик попыток: его смена перезапускает загрузку. */
  const [attempt, setAttempt] = useState(0)
  const [habits, setHabits] = useState<Habit[]>(cached?.habits ?? [])
  const [entries, setEntries] = useState<Entry[]>(cached?.entries ?? [])
  const [settings, setSettings] = useState<Settings>(cached?.settings ?? DEFAULT_SETTINGS)
  const [friends, setFriends] = useState<Friend[]>([])
  const [celebration, setCelebration] = useState<Milestone | null>(null)

  // `saveSettings` объявлена ниже, а нужна уже в `toggleEntry`. Ссылка
  // разрывает циклическую зависимость между ними.
  const saveSettingsRef = useRef<(patch: Partial<Settings>) => Promise<void>>(async () => {})

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [loadedHabits, loadedEntries, loadedSettings] = await Promise.all([
          dataSource.getHabits(),
          dataSource.getEntries(),
          dataSource.getSettings(),
        ])
        if (cancelled) return

        // При самом первом запуске подхватываем из Telegram язык — но не тему:
        // стартовая тема Habora по ТЗ тёмная, и светлый клиент Telegram не должен
        // её переопределять. Дальше и то и другое решает пользователь.
        let initial = loadedSettings
        if (!loadedSettings.onboarded) {
          const lang = telegramLang()
          if (lang) initial = { ...loadedSettings, lang }
        }

        setHabits(loadedHabits)
        setEntries(loadedEntries)
        setSettings(initial)
        setFailed(false)
        setReady(true)
      } catch (error) {
        if (cancelled) return

        /*
         * Доступ закрыт. Здесь снимок как раз убираем: иначе приложение
         * продолжало бы показывать прежние привычки и принимать отметки,
         * которым некуда уйти, — то есть выглядело бы работающим, не работая.
         */
        if (error instanceof AccessDenied) {
          clearSnapshot()
          setDenied(true)
          return
        }

        /*
         * Сервер не ответил. Если на экране уже показан снимок с прошлого
         * запуска — оставляем его: подменять работающее приложение сообщением
         * об ошибке значит отнять у человека то, что у него только что было.
         * Экран неудачи нужен только когда показывать нечего.
         */
        if (cached === null) setFailed(true)
      }
    }

    setFailed(false)
    void load()

    // Отдельно от загрузки и без ожидания: счётчик заходов — не та вещь,
    // ради которой пользователь должен ждать открытия приложения или из-за
    // которой оно вообще не откроется, если запрос не прошёл.
    void dataSource.recordVisit?.().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [dataSource, attempt, cached])

  /*
   * Снимок обновляется при любом изменении данных, а не только после загрузки
   * с сервера. Отметки применяются сразу, не дожидаясь записи, — и в снимок
   * они должны попадать так же: иначе поставленная галочка пропала бы при
   * следующем открытии, если запись на сервер ещё не прошла.
   *
   * До готовности не пишем: там пустое начальное состояние, и оно затёрло бы
   * годный снимок ещё до того, как его успели показать. При закрытом доступе —
   * тоже: снимок только что стёрли, и записывать его обратно незачем.
   */
  useEffect(() => {
    if (!ready || denied || !dataSource.remote) return
    writeSnapshot(habits, entries, settings)
  }, [ready, denied, dataSource, habits, entries, settings])

  /** Сколько раз привычку выполнили в каждый из дней. */
  const counts = useMemo(
    () => new Map(entries.map((e) => [entryKey(e.habitId, e.date), e.count ?? 1])),
    [entries],
  )

  /** Норма привычки; привычки нет — считаем, что раз в день. */
  const targetOf = useCallback(
    (habitId: string) => Math.max(1, habits.find((habit) => habit.id === habitId)?.target ?? 1),
    [habits],
  )

  const countOf = useCallback(
    (habitId: string, date: IsoDate) => counts.get(entryKey(habitId, date)) ?? 0,
    [counts],
  )

  /*
   * День выполнен, когда набрана норма. У привычки с нормой в один раз это
   * ровно прежнее «отметка есть — день выполнен», поэтому серии, проценты и
   * календари от появления счётчика не сдвинулись ни на день.
   */
  const isDone = useCallback(
    (habitId: string, date: IsoDate) => countOf(habitId, date) >= targetOf(habitId),
    [countOf, targetOf],
  )

  /*
   * Прошлые списки дат — чтобы вернуть те же самые массивы привычкам, которых
   * отметка не коснулась.
   *
   * Без этого карта пересобирается целиком при любом изменении, и каждая
   * привычка получает новый массив. Для React это «данные изменились», и он
   * перерисовывает все карточки — в годовом виде это под тысячу клеток на
   * ровном месте, заметная задержка в момент нажатия. Сохранённая ссылка
   * позволяет карточке узнать, что у неё ничего не поменялось.
   */
  const previousDates = useRef(new Map<string, IsoDate[]>())
  const previousPartial = useRef(new Map<string, IsoDate[]>())

  /**
   * Дни по привычкам: отдельно закрытые, отдельно начатые и недобранные.
   *
   * Закрытые — то, чем живёт вся аналитика: серии, проценты, календари,
   * сетка года. Список тот же самый, что и раньше, поэтому ни одну из них
   * счётчик не коснулся.
   *
   * Недобранные нужны только для показа: день, где выпито два стакана из
   * трёх, не выполнен — но и не пуст, и выглядеть как нетронутый не должен.
   */
  const [datesByHabit, partialByHabit] = useMemo(() => {
    const full = new Map<string, IsoDate[]>()
    const partial = new Map<string, IsoDate[]>()

    for (const entry of entries) {
      const done = (entry.count ?? 1) >= Math.max(1, habits.find((h) => h.id === entry.habitId)?.target ?? 1)
      const map = done ? full : partial
      const list = map.get(entry.habitId)
      if (list) list.push(entry.date)
      else map.set(entry.habitId, [entry.date])
    }

    for (const map of [full, partial]) for (const list of map.values()) list.sort()

    // Те же самые массивы для привычек, которых отметка не коснулась.
    const keep = (map: Map<string, IsoDate[]>, before: Map<string, IsoDate[]>) => {
      for (const [habitId, list] of map) {
        const was = before.get(habitId)
        if (was?.length === list.length && was.every((date, i) => date === list[i])) {
          map.set(habitId, was)
        }
      }
      return map
    }

    keep(full, previousDates.current)
    keep(partial, previousPartial.current)
    previousDates.current = full
    previousPartial.current = partial
    return [full, partial]
  }, [entries, habits])

  // Пустой список тоже должен быть одной и той же ссылкой: иначе привычка без
  // отметок получала бы новый массив при каждом обращении и перерисовывалась
  // бы всегда — ровно то, от чего избавляет сохранение ссылок выше.
  const noDates = useRef<IsoDate[]>([]).current

  const datesOf = useCallback(
    (habitId: string) => datesByHabit.get(habitId) ?? noDates,
    [datesByHabit, noDates],
  )

  const partialDatesOf = useCallback(
    (habitId: string) => partialByHabit.get(habitId) ?? noDates,
    [partialByHabit, noDates],
  )

  /** Дни с любой активностью — для общей серии приложения. */
  const activeDates = useMemo(() => [...new Set(entries.map((entry) => entry.date))], [entries])

  const markEntry = useCallback(
    async (habitId: string, date: IsoDate, action: MarkAction = 'inc') => {
      const key = entryKey(habitId, date)
      const target = Math.max(1, habits.find((h) => h.id === habitId)?.target ?? 1)
      const before = counts.get(key) ?? 0

      const after =
        action === 'full'
          ? target
          : action === 'clear'
            ? 0
            : action === 'dec'
              ? Math.max(0, before - 1)
              : Math.min(target, before + 1)

      if (after === before) return

      const nextEntries =
        after === 0
          ? entries.filter((e) => entryKey(e.habitId, e.date) !== key)
          : counts.has(key)
            ? entries.map((e) => (entryKey(e.habitId, e.date) === key ? { ...e, count: after } : e))
            : [...entries, { habitId, date, count: after }]

      setEntries(nextEntries)

      /*
       * Салют — только когда день закрылся именно сейчас. Не на каждое
       * нажатие: у привычки с нормой в три раза он вылетал бы трижды за день,
       * и первый же из них был бы за недоделанное.
       */
      if (after >= target && before < target) {
        const habit = habits.find((h) => h.id === habitId)
        if (habit) {
          const found = detectMilestone({
            habit,
            // Только закрытые дни: веха «сто дней подряд» не должна
            // засчитывать день, в котором норму так и не добрали.
            habitDates: nextEntries
              .filter((e) => e.habitId === habitId && (e.count ?? 1) >= target)
              .map((e) => e.date)
              .sort(),
            activeDates: [...new Set([...activeDates, date])],
            totalEntries: nextEntries.length,
            celebrated: settings.celebrated,
          })

          if (found) {
            setCelebration(found)
            // Запоминаем сразу: иначе повторная простановка той же галочки
            // покажет тот же салют ещё раз.
            void saveSettingsRef.current({ celebrated: [...settings.celebrated, found.key] })
          }
        }
      }

      try {
        await dataSource.markEntry(habitId, date, action)
      } catch {
        // Запись не прошла — возвращаем интерфейс к тому, что реально в хранилище.
        setEntries(await dataSource.getEntries())
      }
    },
    [dataSource, counts, entries, habits, activeDates, settings.celebrated],
  )

  const createHabit = useCallback(
    async (input: HabitInput) => {
      const habit = await dataSource.createHabit(input)
      setHabits((prev) => [...prev, habit])
      return habit
    },
    [dataSource],
  )

  const updateHabit = useCallback(
    async (id: string, patch: Partial<HabitInput>) => {
      const updated = await dataSource.updateHabit(id, patch)
      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)))
    },
    [dataSource],
  )

  /**
   * Своё время напоминания по привычке.
   *
   * Меняем состояние сразу, не дожидаясь сервера: переключатель должен
   * отзываться мгновенно, а час — личная настройка, и разойтись с чужими
   * данными она не может.
   */
  const setReminders = useCallback(
    async (id: string, times: string[]) => {
      const sorted = [...new Set(times)].sort()
      setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, remindTimes: sorted } : h)))
      await dataSource.setReminders(id, sorted)
    },
    [dataSource],
  )

  const deleteHabit = useCallback(
    async (id: string) => {
      await dataSource.deleteHabit(id)
      setHabits((prev) => prev.filter((h) => h.id !== id))
      setEntries((prev) => prev.filter((e) => e.habitId !== id))
    },
    [dataSource],
  )

  const reorderHabits = useCallback(
    async (ids: string[]) => {
      setHabits(await dataSource.reorderHabits(ids))
    },
    [dataSource],
  )

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }))
      await dataSource.saveSettings(patch)
    },
    [dataSource],
  )

  saveSettingsRef.current = saveSettings

  /**
   * Отметки друзей приходят только по запросу: они ставятся на чужих
   * телефонах, и узнать о них можно, лишь спросив заново. Ошибку не
   * поднимаем — пустой список друзей не повод ломать экран.
   */
  const refreshFriends = useCallback(async () => {
    if (!dataSource.getFriends) return
    try {
      setFriends(await dataSource.getFriends())
    } catch {
      setFriends([])
    }
  }, [dataSource])

  const inviteLink = useCallback(
    async (habitId: string) => {
      if (!dataSource.getInviteLink) return null
      try {
        return await dataSource.getInviteLink(habitId)
      } catch {
        return null
      }
    },
    [dataSource],
  )

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const dismissCelebration = useCallback(() => setCelebration(null), [])

  const value: StoreValue = useMemo(
    () => ({
      ready,
      failed,
      denied,
      retry,
      habits,
      entries,
      settings,
      friends,
      refreshFriends,
      inviteLink,
      isDone,
      countOf,
      targetOf,
      datesOf,
      partialDatesOf,
      activeDates,
      markEntry,
      createHabit,
      updateHabit,
      setReminders,
      deleteHabit,
      reorderHabits,
      saveSettings,
      celebration,
      dismissCelebration,
    }),
    [
      ready, failed, denied, retry, habits, entries, settings, friends, refreshFriends, inviteLink,
      isDone, countOf, targetOf, datesOf, partialDatesOf, activeDates, markEntry,
      createHabit, updateHabit, setReminders, deleteHabit, reorderHabits,
      saveSettings, celebration, dismissCelebration,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
