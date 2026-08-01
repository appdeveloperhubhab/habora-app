import { useStore } from '../../store/context'
import { useNav } from '../../shell/navigation'
import { dict } from '../../i18n'
import { hapticSelect } from '../../lib/haptics'
import { Icon } from '../../ui/Icon'
import type { Lang } from '../../types'
import styles from './SettingsScreen.module.css'

/**
 * Настройки — строгий список без палитр и предпросмотров внутри.
 *
 * Вся кастомизация внешнего вида вынесена на отдельный экран «Тема»: раньше
 * палитра из полусотни кружков лежала прямо здесь и занимала больше места,
 * чем все остальные настройки вместе взятые.
 */
export function SettingsScreen({ onBack }: { onBack(): void }) {
  const { settings, saveSettings } = useStore()
  const nav = useNav()
  const t = dict(settings.lang)

  const setLang = (lang: Lang) => {
    if (lang === settings.lang) return
    hapticSelect()
    void saveSettings({ lang })
  }

  return (
    <div className={styles.screen}>
      <header className={styles.bar}>
        <button className={styles.back} onClick={onBack} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>
        <h2 className={styles.title}>{t.settings.title}</h2>
        <span />
      </header>

      <div className={styles.content}>
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.appearance}</h3>
          <div className={styles.rows}>
            <button className={styles.row} onClick={() => nav.push({ name: 'themeSettings' })}>
              <span className={styles.rowLabel}>{t.settings.theme}</span>
              <span className={styles.rowValue}>
                {settings.theme === 'dark' ? t.settings.themeDark : t.settings.themeLight}
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
          </div>
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.language}</h3>
          <div className={styles.segment}>
            <button
              className={settings.lang === 'ru' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => setLang('ru')}
            >
              Русский
            </button>
            <button
              className={settings.lang === 'en' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => setLang('en')}
            >
              English
            </button>
          </div>
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.project}</h3>
          <div className={styles.rows}>
            {/* Ссылки появятся, когда будут известны адреса аккаунтов —
                пока пункты видны, но не ведут в никуда. */}
            <div className={`${styles.row} ${styles.rowDisabled}`}>
              <span className={styles.rowLabel}>Instagram</span>
              <span className={styles.badge}>{t.settings.soon}</span>
            </div>
            <div className={`${styles.row} ${styles.rowDisabled}`}>
              <span className={styles.rowLabel}>TikTok</span>
              <span className={styles.badge}>{t.settings.soon}</span>
            </div>
            <div className={`${styles.row} ${styles.rowDisabled}`}>
              <span className={styles.rowLabel}>{t.settings.support}</span>
              <span className={styles.badge}>{t.settings.soon}</span>
            </div>
          </div>
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.about}</h3>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t.settings.version}</span>
              <span className={styles.rowValue}>0.1</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
