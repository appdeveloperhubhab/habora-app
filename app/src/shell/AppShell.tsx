import { useState } from 'react'
import { useStore } from '../store/context'
import { useNav } from './navigation'
import { dict } from '../i18n'
import { todayIso } from '../lib/dates'
import { startTimer } from '../lib/timer'
import { HabitsScreen } from '../features/habits/HabitsScreen'
import { HabitEditor } from '../features/habits/HabitEditor'
import { HabitScreen } from '../features/habits/detail/HabitScreen'
import { FriendsScreen } from '../features/friends/FriendsScreen'
import { SharedHabitScreen } from '../features/friends/SharedHabitScreen'
import { InviteSheet } from '../features/friends/InviteSheet'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { ThemeScreen } from '../features/settings/ThemeScreen'
import { TimerScreen } from '../features/timer/TimerScreen'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { Celebration } from '../ui/Celebration'
import { SwipeBack } from './SwipeBack'
import { TopBar } from './TopBar'
import { OrderBar } from './OrderBar'
import { BottomTabs } from './BottomTabs'
import { Placeholder } from './Placeholder'
import { Loading } from './Loading'
import styles from './AppShell.module.css'

/**
 * Оболочка приложения: главный экран с вкладками всегда смонтирован,
 * а экраны стека навигации накладываются поверх. Так возврат назад мгновенный —
 * список привычек не пересобирается и не теряет позицию скролла.
 */
export function AppShell() {
  const { ready, failed, retry, settings, celebration, dismissCelebration, saveSettings } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)

  const [orderMode, setOrderMode] = useState(false)
  const [inviting, setInviting] = useState(false)

  if (!ready) return <Loading failed={failed} onRetry={retry} t={t} />

  // Первый запуск: вместо пустого списка человек видит приветствие
  // и выбор готовых привычек.
  if (!settings.onboarded) return <OnboardingScreen />

  return (
    <div className={styles.app}>
      <TopBar
        title={t.tabs[nav.tab]}
        settingsLabel={t.menu.settings}
        orderLabel={t.menu.order}
        onSettings={() => nav.push({ name: 'settings' })}
        onOrder={() => {
          // Режим настройки вида есть только у привычек: у друзей карточка одна.
          nav.setTab('habits')
          setOrderMode(true)
        }}
        onAdd={() => {
          // «Плюс» означает главное действие раздела: на привычках — завести
          // привычку, на друзьях — позвать друга.
          if (nav.tab === 'friends') setInviting(true)
          else nav.push({ name: 'habitEditor', habitId: null })
        }}
        orderMode={orderMode}
        doneLabel={t.topbar.done}
        onDone={() => setOrderMode(false)}
      />

      <main className={styles.content}>
        {nav.tab === 'habits' ? (
          <HabitsScreen orderMode={orderMode} />
        ) : (
          <FriendsScreen
            onInvite={() => setInviting(true)}
            onCreateHabit={() => {
              nav.setTab('habits')
              nav.push({ name: 'habitEditor', habitId: null })
            }}
          />
        )}
      </main>

      <BottomTabs
        tab={nav.tab}
        labels={{ habits: t.tabs.habits, friends: t.tabs.friends }}
        onChange={nav.setTab}
      />

      {orderMode && (
        <OrderBar
          value={settings.cardView}
          labels={{ week: t.habits.viewWeek, month: t.habits.viewMonth, year: t.habits.viewYear }}
          onChange={(cardView) => void saveSettings({ cardView })}
        />
      )}

      <InviteSheet open={inviting} onClose={() => setInviting(false)} />

      {/* Слой жеста заводится только когда есть куда возвращаться: на главном
          экране он был бы пустой обёрткой, слушающей касания впустую. */}
      {nav.stack.length > 1 ? (
        <SwipeBack onBack={nav.pop} screenKey={nav.screen.name}>
          <Overlay />
        </SwipeBack>
      ) : (
        <Overlay />
      )}

      {celebration && <Celebration milestone={celebration} t={t} onClose={dismissCelebration} />}
    </div>
  )
}

/** Экраны поверх главного. */
function Overlay() {
  const nav = useNav()
  const { habits, friends, settings, saveSettings, datesOf, toggleEntry } = useStore()
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
    case 'sharedHabit': {
      const habit = habits.find((item) => item.id === screen.habitId)
      const friend = friends.find((item) => item.userId === screen.friendUserId)
      const shared = friend?.habits.find((item) => item.habitId === screen.habitId)
      // Привычку могли удалить, а друга — уйти из неё, пока экран открыт;
      // общих данных без обеих сторон не бывает, поэтому выходим так же,
      // как и при исчезновении собственной привычки.
      if (!habit || !friend || !shared) {
        return <Placeholder title={t.tabs.friends} note={note} onBack={nav.pop} />
      }
      return (
        <SharedHabitScreen
          habit={habit}
          friend={friend}
          myDates={datesOf(habit.id)}
          friendDates={shared.dates}
          lang={settings.lang}
          t={t}
          onBack={nav.pop}
          onToggle={() => void toggleEntry(habit.id, todayIso())}
        />
      )
    }
    case 'themeSettings':
      return <ThemeScreen onBack={nav.pop} />
    case 'timer':
      return <TimerScreen onClose={nav.pop} />
  }
}
