import { useState } from 'react'
import { useStore } from '../store/context'
import { useNav } from './navigation'
import { dict } from '../i18n'
import { formatDayMonth, todayIso } from '../lib/dates'
import { startTimer } from '../lib/timer'
import { HabitsScreen } from '../features/habits/HabitsScreen'
import { HabitEditor } from '../features/habits/HabitEditor'
import { HabitScreen } from '../features/habits/detail/HabitScreen'
import { TasksScreen } from '../features/tasks/TasksScreen'
import { TaskEditor } from '../features/tasks/TaskEditor'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { ThemeScreen } from '../features/settings/ThemeScreen'
import { TimerScreen } from '../features/timer/TimerScreen'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { Celebration } from '../ui/Celebration'
import { TopBar } from './TopBar'
import { OrderBar } from './OrderBar'
import { BottomTabs } from './BottomTabs'
import { DotsMenu, type MenuItem } from './DotsMenu'
import { Placeholder } from './Placeholder'
import styles from './AppShell.module.css'

/**
 * Оболочка приложения: главный экран с вкладками всегда смонтирован,
 * а экраны стека навигации накладываются поверх. Так возврат назад мгновенный —
 * список привычек не пересобирается и не теряет позицию скролла.
 */
export function AppShell() {
  const { ready, settings, celebration, dismissCelebration, saveSettings } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)

  const [menuOpen, setMenuOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [orderMode, setOrderMode] = useState(false)

  if (!ready) return <div className={styles.splash} />

  // Первый запуск: вместо пустого списка человек видит приветствие
  // и выбор готовых привычек.
  if (!settings.onboarded) return <OnboardingScreen />

  const menuItems: MenuItem[] = [
    { id: 'settings', label: t.menu.settings, icon: 'settings', onSelect: () => nav.push({ name: 'settings' }) },
    {
      id: 'order',
      label: t.menu.order,
      icon: 'viewWeek',
      onSelect: () => {
        // Режим настройки вида есть только у привычек: у задач карточка одна.
        nav.setTab('habits')
        setOrderMode(true)
      },
    },
  ]

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  return (
    <div className={styles.app}>
      <TopBar
        title={t.tabs[nav.tab]}
        date={formatDayMonth(todayIso(), settings.lang)}
        onMenu={() => setMenuOpen(true)}
        onAdd={() =>
          nav.push(nav.tab === 'habits' ? { name: 'habitEditor', habitId: null } : { name: 'taskEditor', taskId: null })
        }
        searching={searching}
        query={query}
        searchPlaceholder={nav.tab === 'habits' ? t.habits.searchPlaceholder : t.tasks.searchPlaceholder}
        onSearchOpen={() => setSearching(true)}
        onSearchClose={closeSearch}
        onQueryChange={setQuery}
        orderMode={orderMode}
        doneLabel={t.topbar.done}
        onDone={() => setOrderMode(false)}
      />

      <main className={styles.content}>
        {nav.tab === 'habits' ? (
          <HabitsScreen query={query} orderMode={orderMode} />
        ) : (
          <TasksScreen query={query} />
        )}
      </main>

      <BottomTabs
        tab={nav.tab}
        labels={{ habits: t.tabs.habits, tasks: t.tabs.tasks }}
        onChange={(tab) => {
          // Поиск привязан к разделу: запрос по привычкам не имеет смысла
          // в списке задач.
          closeSearch()
          nav.setTab(tab)
        }}
      />

      {orderMode && (
        <OrderBar
          value={settings.cardView}
          labels={{ month: t.habits.viewMonth, grid: t.habits.viewGrid, week: t.habits.viewWeek }}
          onChange={(cardView) => void saveSettings({ cardView })}
          onClose={() => setOrderMode(false)}
        />
      )}

      <DotsMenu open={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />

      <Overlay />

      {celebration && <Celebration milestone={celebration} t={t} onClose={dismissCelebration} />}
    </div>
  )
}

/** Экраны поверх главного. */
function Overlay() {
  const nav = useNav()
  const { habits, tasks, settings, saveSettings } = useStore()
  const t = dict(settings.lang)

  const note =
    settings.lang === 'ru'
      ? 'Этот экран появится на следующем этапе разработки.'
      : 'This screen is coming in the next milestone.'

  // Разбор идёт по локальной переменной: обращение к свойству объекта
  // TypeScript не сужает, и вариант экрана не был бы виден внутри ветвей.
  const screen = nav.screen

  switch (screen.name) {
    case 'home':
      return null
    case 'habitEditor': {
      const habit = habits.find((h) => h.id === screen.habitId) ?? null
      return <HabitEditor habit={habit} onClose={nav.pop} />
    }
    case 'settings':
      return <SettingsScreen onBack={nav.pop} />
    case 'taskEditor': {
      const task = tasks.find((item) => item.id === screen.taskId) ?? null
      return <TaskEditor task={task} onClose={nav.pop} />
    }
    case 'habit': {
      const habit = habits.find((item) => item.id === screen.habitId)
      // Привычку могли удалить, пока её экран открыт, — тогда просто выходим.
      if (!habit) return <Placeholder title={t.tabs.habits} note={note} onBack={nav.pop} />
      return (
        <HabitScreen
          habit={habit}
          onBack={nav.pop}
          onEdit={() => nav.push({ name: 'habitEditor', habitId: habit.id })}
          onOpenTimer={() => {
            // Таймер этой же привычки уже идёт — открываем его, а не
            // запускаем заново, иначе тап сбросил бы начатый отсчёт.
            if (habit.durationSec !== null && settings.timer?.id !== habit.id) {
              void saveSettings({ timer: startTimer('habit', habit.id, habit.durationSec) })
            }
            nav.push({ name: 'timer' })
          }}
        />
      )
    }
    case 'themeSettings':
      return <ThemeScreen onBack={nav.pop} />
    case 'timer':
      return <TimerScreen onClose={nav.pop} />
  }
}
