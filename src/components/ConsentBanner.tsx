// ============================================================
// ConsentBanner — slim, non-intrusive cookie opt-in for the Google
// Ads tag. Shown when the device clock is in the EEA / UK / CH, or names
// no place (see lib/consent.ts). Elsewhere Google's IP-based region
// defaults decide, and Settings › About › Cookie settings opens it for anyone.
//
// Mounts as its own tiny Solid root (setupConsent) so neither the
// main app nor the standalone Voice Mirror entry has to thread it
// through their trees. Styling is self-contained: it reads the app's
// theme tokens when present and falls back to a dark glass that suits
// the cosmic Mirror page.
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { acceptConsent, closeConsentSettings, consentSettingsLine, declineConsent, hasAnyTag, initConsent, isConsentBannerOpen, isConsentSettingsOpen, markConsentBannerMounted, } from '@/lib/consent'
import { PRIVACY_URL } from '@/lib/legal-links'
import styles from './ConsentBanner.module.css'

const ShieldIcon: Component = () => (
  <svg
    class={styles.icon}
    viewBox="0 0 24 24"
    width="18"
    height="18"
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1.2 15.5-3.8-3.8 1.4-1.4 2.4 2.4 5-5 1.4 1.4-6.4 6.4z"
    />
  </svg>
)

const CloseIcon: Component = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6L6 18"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
)

export const ConsentBanner: Component = () => {
  // Escape closes Cookie settings, as the landing's banner does. The first
  // ask has no close: it waits for a choice.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && isConsentSettingsOpen()) closeConsentSettings()
  }
  onMount(() => document.addEventListener('keydown', onKey))
  onCleanup(() => document.removeEventListener('keydown', onKey))

  return (
    <Show when={isConsentBannerOpen()}>
      <section
        class={styles.banner}
        role="dialog"
        aria-label="Cookie consent"
        aria-live="polite"
      >
        <Show when={consentSettingsLine() !== ''}>
          <p class={styles.status} data-testid="consent-status">
            {consentSettingsLine()}
          </p>
        </Show>
        <Show when={isConsentSettingsOpen()}>
          <button
            type="button"
            class={styles.close}
            aria-label="Close cookie settings"
            onClick={() => closeConsentSettings()}
          >
            <CloseIcon />
          </button>
        </Show>
        <div class={styles.copy}>
          <ShieldIcon />
          <p class={styles.text}>
            We'd like to use Google cookies to measure our ads and see how the
            site is used.{' '}
            <strong>Pitch detection runs on your device either way.</strong>{' '}
            <a
              class={styles.link}
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy&nbsp;Notice
            </a>
          </p>
        </div>
        <div class={styles.actions}>
          {/* One class for both: equal size, weight and contrast, so neither
              reads as the default (EDPB cookie banner taskforce). */}
          <button
            type="button"
            class={styles.choice}
            data-testid="consent-decline"
            onClick={() => declineConsent()}
          >
            Decline
          </button>
          <button
            type="button"
            class={styles.choice}
            data-testid="consent-accept"
            onClick={() => acceptConsent()}
          >
            Accept
          </button>
        </div>
      </section>
    </Show>
  )
}

const HOST_ID = 'mp-consent-root'

/**
 * Boot Consent Mode and mount the banner into its own root appended to
 * <body>. Idempotent — call once per entry point (index.tsx, mirror/main).
 * No-op unless the build ships an ad tag, so dev / test / tour builds add
 * nothing to the DOM.
 */
export function setupConsent(): void {
  if (typeof document === 'undefined') return
  initConsent()
  if (!hasAnyTag()) return
  if (document.getElementById(HOST_ID) !== null) return
  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)
  render(() => <ConsentBanner />, host)
  markConsentBannerMounted()
}
