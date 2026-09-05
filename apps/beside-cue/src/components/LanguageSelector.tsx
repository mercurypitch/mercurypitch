// ============================================================
// Language selector — one accessible locale control for setup and Settings
// ============================================================

import { For, Show } from 'solid-js'
import { useLocale } from '@/i18n/context'
import type { AppLocale } from '@/i18n/locale'
import { AVAILABLE_LOCALES, LANGUAGE_NAMES } from '@/i18n/locale'
import { useCopy } from '@/i18n/ui-copy'
import styles from './LanguageSelector.module.css'

interface LanguageSelectorProps {
  readonly compact?: boolean
  readonly showVoiceNote?: boolean
}

export function LanguageSelector(props: LanguageSelectorProps) {
  const localeContext = useLocale()
  const copy = useCopy()

  return (
    <div
      class={styles.selector}
      classList={{ [styles.compact]: props.compact === true }}
    >
      <label class={styles.control}>
        <span>{copy.t('Language')}</span>
        <select
          value={localeContext.locale()}
          disabled={localeContext.changeDisabled()}
          aria-label={copy.t('Choose interface language')}
          onChange={(event) => {
            const locale = event.currentTarget.value as AppLocale
            localeContext.changeLocale(locale)
          }}
        >
          <For each={AVAILABLE_LOCALES}>
            {(locale) => (
              <option value={locale}>{LANGUAGE_NAMES[locale]}</option>
            )}
          </For>
        </select>
      </label>
      <Show
        when={props.showVoiceNote === true && localeContext.locale() !== 'en'}
      >
        <p class={styles.note}>
          {copy.t(
            'Corky and the six original Pulls speak this language. Premium Pulls have translated captions only.',
          )}
        </p>
      </Show>
    </div>
  )
}
