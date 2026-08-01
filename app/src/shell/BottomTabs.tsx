import { Icon } from '../ui/Icon'
import type { Tab } from './navigation'
import styles from './BottomTabs.module.css'

/**
 * Нижняя навигация из двух разделов. Habora — мультитрекер: привычки
 * повторяются регулярно, задачи разовые, данные у них независимые,
 * а верхняя панель и визуальный язык общие.
 *
 * Панель сделана плавающей капсулой по центру, а не полосой во всю ширину:
 * она не режет экран горизонтальной линией и оставляет фон видимым по краям.
 */

const TABS: { id: Tab; icon: 'habits' | 'tasks' }[] = [
  { id: 'habits', icon: 'habits' },
  { id: 'tasks', icon: 'tasks' },
]

export function BottomTabs({
  tab,
  labels,
  onChange,
}: {
  tab: Tab
  labels: Record<Tab, string>
  onChange(tab: Tab): void
}) {
  const activeIndex = TABS.findIndex((item) => item.id === tab)

  return (
    <nav className={styles.wrap}>
      <div className={styles.capsule}>
        {/*
          Подсветка переезжает между вкладками, а не перекрашивается скачком.
          Шаг — ширина вкладки плюс зазор между ними: без поправки на зазор
          подсветка встаёт мимо иконки.
        */}
        <span
          className={styles.thumb}
          style={{ transform: `translateX(calc(${activeIndex} * (100% + 4px)))` }}
        />

        {TABS.map((item) => {
          const active = item.id === tab
          return (
            <button
              key={item.id}
              className={active ? `${styles.tab} ${styles.active}` : styles.tab}
              onClick={() => onChange(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={item.icon} size={21} strokeWidth={active ? 2.1 : 1.8} />
              <span className={styles.label}>{labels[item.id]}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
