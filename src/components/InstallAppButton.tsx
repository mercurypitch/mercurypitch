// ============================================================
// Install App Button — offers the native install sheet, or tells iOS how
// ============================================================
// Renders nothing at all unless installing is genuinely possible: no button
// when the app is already running standalone, none on a browser that never
// fires `beforeinstallprompt`, and on iOS Safari — where no install API exists
// — a Share menu hint instead of a button that could not work.
//
// `canOfferInstall()` is exported so a container can decide whether its whole
// section is worth drawing.

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { InstallApp, IosShare } from '@/components/icons'
import { canInstall, needsIosInstallHint, promptInstall } from '@/lib/pwa-install'
import styles from './InstallAppButton.module.css'

export interface InstallAppButtonProps {
  /**
   * `header` is the compact pill that sits beside the support badge and drops
   * its label on narrow screens; `panel` is the full-width control in Settings.
   */
  variant?: 'header' | 'panel'
}

/** True when this browser has something to offer — a prompt or the iOS hint. */
export function canOfferInstall(): boolean {
  return canInstall() || needsIosInstallHint()
}

export const InstallAppButton: Component<InstallAppButtonProps> = (props) => {
  const [busy, setBusy] = createSignal(false)

  const variantClass = (): string =>
    props.variant === 'panel' ? styles.panel : styles.header

  const handleClick = (): void => {
    if (busy()) return
    setBusy(true)
    void promptInstall().finally(() => {
      setBusy(false)
    })
  }

  return (
    <>
      <Show when={canInstall()}>
        <button
          type="button"
          class={[styles.installBtn, variantClass()].join(' ')}
          data-testid="install-app-button"
          title="Install MercuryPitch as an app"
          aria-label="Install MercuryPitch as an app"
          disabled={busy()}
          onClick={handleClick}
        >
          <InstallApp size={props.variant === 'panel' ? 17 : 15} />
          <span class={styles.label}>Install app</span>
        </button>
      </Show>

      {/* iOS only, and only in the panel: a hint has nowhere useful to go in a
          header pill, and it must never be mistaken for a button. */}
      <Show when={props.variant === 'panel' && !canInstall() && needsIosInstallHint()}>
        <p class={styles.iosHint} data-testid="install-app-ios-hint">
          <IosShare size={16} />
          <span>
            On iPhone and iPad, open the Share menu in Safari and choose Add to
            Home Screen.
          </span>
        </p>
      </Show>
    </>
  )
}
