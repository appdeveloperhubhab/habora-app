import { useRef, useState } from 'react'
import type { BackgroundKind, ThemeMode } from '../../types'
import { useStore } from '../../store/context'
import { dict } from '../../i18n'
import { hapticSelect, hapticWarning } from '../../lib/haptics'
import { ColorPicker } from '../../ui/ColorPicker'
import { ColorStrip } from '../../ui/ColorStrip'
import { Sheet } from '../../ui/Sheet'
import { Icon } from '../../ui/Icon'
import styles from './ThemeScreen.module.css'

/**
 * Экран «Тема» — вся кастомизация внешнего вида в одном месте:
 * светлая или тёмная тема, акцентный цвет приложения и фон.
 *
 * Изменения применяются сразу ко всему приложению, а не по кнопке «Сохранить»:
 * превью сверху и есть предпросмотр, но настоящий результат виден за ним.
 */

/** Готовые сочетания для тех, кто не хочет подбирать цвета вручную. */
const GRADIENT_PRESETS: [string, string][] = [
  ['#2b1055', '#7597de'],
  ['#0f2027', '#2c5364'],
  ['#42275a', '#734b6d'],
  ['#1f1c2c', '#928dab'],
  ['#16222a', '#3a6073'],
  ['#3a1c71', '#d76d77'],
  ['#000428', '#004e92'],
  ['#232526', '#414345'],
]

/** Максимальная ширина сохраняемого фото. */
const MAX_PHOTO_WIDTH = 1080

export function ThemeScreen({ onBack }: { onBack(): void }) {
  const { settings, saveSettings } = useStore()
  const t = dict(settings.lang)

  const fileInput = useRef<HTMLInputElement>(null)
  const [paletteFor, setPaletteFor] = useState<'accent' | 'from' | 'to' | null>(null)

  const setTheme = (theme: ThemeMode) => {
    if (theme === settings.theme) return
    hapticSelect()
    void saveSettings({ theme })
  }

  const setKind = (backgroundKind: BackgroundKind) => {
    if (backgroundKind === settings.backgroundKind) return
    hapticSelect()
    void saveSettings({ backgroundKind })
  }

  /**
   * Фото уменьшаем перед сохранением: оригинал с камеры телефона весит
   * несколько мегабайт и не помещается в хранилище браузера целиком.
   */
  const handlePhoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_WIDTH / image.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)

        const context = canvas.getContext('2d')
        if (!context) return
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        try {
          void saveSettings({
            backgroundImage: canvas.toDataURL('image/jpeg', 0.72),
            backgroundKind: 'photo',
          })
        } catch {
          hapticWarning()
        }
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const previewStyle: React.CSSProperties = (() => {
    if (settings.backgroundKind === 'gradient') {
      return { backgroundImage: `linear-gradient(160deg, ${settings.gradientFrom}, ${settings.gradientTo})` }
    }
    if (settings.backgroundKind === 'photo' && settings.backgroundImage) {
      return { backgroundImage: `url(${settings.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    }
    if (settings.backgroundKind === 'accent') {
      return {
        backgroundImage: `radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, ${settings.accentColor} 42%, transparent), transparent 70%)`,
      }
    }
    return {}
  })()

  return (
    <div className={styles.screen}>
      <header className={styles.bar}>
        <button className={styles.back} onClick={onBack} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>
        <h2 className={styles.title}>{t.settings.theme}</h2>
        <span />
      </header>

      <div className={styles.content}>
        <section className={styles.previewBlock}>
          <div className={styles.phone} style={previewStyle}>
            <div className={styles.phoneBar}>
              <span className={styles.phoneDot} />
              <span className={styles.phoneTitle}>{t.tabs.habits}</span>
              <span className={styles.phoneDot} />
            </div>
            <div className={styles.phoneCard} style={{ '--habit': settings.accentColor } as React.CSSProperties} />
            <div className={styles.phoneCard} style={{ '--habit': settings.accentColor } as React.CSSProperties} />
          </div>
          <p className={styles.previewHint}>{t.settings.preview}</p>
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.theme}</h3>
          <div className={styles.segment}>
            <button
              className={settings.theme === 'dark' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => setTheme('dark')}
            >
              {t.settings.themeDark}
            </button>
            <button
              className={settings.theme === 'light' ? `${styles.segmentItem} ${styles.segmentActive}` : styles.segmentItem}
              onClick={() => setTheme('light')}
            >
              {t.settings.themeLight}
            </button>
          </div>
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.accent}</h3>
          <ColorStrip
            value={settings.accentColor}
            onChange={(accentColor) => void saveSettings({ accentColor })}
            onOpenPalette={() => setPaletteFor('accent')}
          />
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t.settings.background}</h3>

          <div className={styles.options}>
            <BackgroundOption
              active={settings.backgroundKind === 'none'}
              title={t.settings.bgNone}
              hint={t.settings.bgNoneHint}
              onSelect={() => setKind('none')}
            />
            <BackgroundOption
              active={settings.backgroundKind === 'accent'}
              title={t.settings.bgAccent}
              hint={t.settings.bgAccentHint}
              onSelect={() => setKind('accent')}
            />
            <BackgroundOption
              active={settings.backgroundKind === 'gradient'}
              title={t.settings.bgGradient}
              hint={t.settings.bgGradientHint}
              onSelect={() => setKind('gradient')}
            />
            <BackgroundOption
              active={settings.backgroundKind === 'photo'}
              title={t.settings.bgPhoto}
              hint={t.settings.bgPhotoHint}
              onSelect={() => setKind('photo')}
            />
          </div>
        </section>

        {settings.backgroundKind === 'gradient' && (
          <section className={styles.group}>
            <div className={styles.gradientRow}>
              <button
                className={styles.gradientSwatch}
                style={{ background: settings.gradientFrom }}
                onClick={() => setPaletteFor('from')}
              >
                <span className={styles.gradientLabel}>{t.settings.gradientFrom}</span>
              </button>
              <button
                className={styles.gradientSwatch}
                style={{ background: settings.gradientTo }}
                onClick={() => setPaletteFor('to')}
              >
                <span className={styles.gradientLabel}>{t.settings.gradientTo}</span>
              </button>
            </div>

            <h3 className={styles.groupTitle}>{t.settings.presets}</h3>
            <div className={styles.presets}>
              {GRADIENT_PRESETS.map(([from, to]) => (
                <button
                  key={`${from}${to}`}
                  className={
                    settings.gradientFrom === from && settings.gradientTo === to
                      ? `${styles.preset} ${styles.presetActive}`
                      : styles.preset
                  }
                  style={{ backgroundImage: `linear-gradient(160deg, ${from}, ${to})` }}
                  onClick={() => {
                    hapticSelect()
                    void saveSettings({ gradientFrom: from, gradientTo: to })
                  }}
                  aria-label={`${from} → ${to}`}
                />
              ))}
            </div>
          </section>
        )}

        {settings.backgroundKind === 'photo' && (
          <section className={styles.group}>
            <button className={styles.photoButton} onClick={() => fileInput.current?.click()}>
              {t.settings.choosePhoto}
            </button>
            {settings.backgroundImage && (
              <button
                className={styles.photoRemove}
                onClick={() => void saveSettings({ backgroundImage: null, backgroundKind: 'none' })}
              >
                {t.settings.removePhoto}
              </button>
            )}
            <input
              ref={fileInput}
              className={styles.fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePhoto(file)
                e.target.value = ''
              }}
            />
          </section>
        )}
      </div>

      <Sheet open={paletteFor !== null} title={t.settings.accent} onClose={() => setPaletteFor(null)}>
        <ColorPicker
          value={
            paletteFor === 'from'
              ? settings.gradientFrom
              : paletteFor === 'to'
                ? settings.gradientTo
                : settings.accentColor
          }
          lang={settings.lang}
          onChange={(color) => {
            if (paletteFor === 'from') void saveSettings({ gradientFrom: color })
            else if (paletteFor === 'to') void saveSettings({ gradientTo: color })
            else void saveSettings({ accentColor: color })
            setPaletteFor(null)
          }}
        />
      </Sheet>
    </div>
  )
}

function BackgroundOption({
  active,
  title,
  hint,
  onSelect,
}: {
  active: boolean
  title: string
  hint: string
  onSelect(): void
}) {
  return (
    <button className={active ? `${styles.option} ${styles.optionActive}` : styles.option} onClick={onSelect}>
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionHint}>{hint}</span>
      </span>
      <span className={styles.radio}>{active && <Icon name="check" size={14} />}</span>
    </button>
  )
}
