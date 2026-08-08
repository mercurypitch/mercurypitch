// The Guitar Night account chip: who is signed in, and what credits remain.
// ============================================================
//
// Lazy-loaded so the auth and billing services stay out of the room's first
// paint. It reports state and links out; it does not carry a sign-in form.
// Signing in happens in the studio, which owns the shared AuthModal — pulling
// that modal here would drag the app shell (ui-store, notifications,
// voiceprints) onto a standalone page that deliberately has none of it.

import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { UserRound } from '@/components/icons'
import { account, accountReady, credits, refreshAccount, signedIn, signOutStandalone, } from '@/lib/standalone-account'
import styles from './GuitarNightApp.module.css'

export function GuitarNightAccount() {
  const [menuOpen, setMenuOpen] = createSignal(false)

  onMount(() => {
    void refreshAccount()
    // Any click outside closes the menu: it overlaps the stage, and a menu
    // left open over a moving tab is worse than no menu.
    const closeOnOutside = (event: MouseEvent): void => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(`.${styles.accountChipWrap}`) !== null
      ) {
        return
      }
      setMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutside)
    onCleanup(() => window.removeEventListener('pointerdown', closeOnOutside))
  })

  const email = () => account()?.email ?? ''
  // The local part only: a long address would push the room name off a phone.
  const shortName = () => {
    const full = email()
    if (full === '') return 'Account'
    const at = full.indexOf('@')
    return at > 0 ? full.slice(0, at) : full
  }

  return (
    <Show when={accountReady()}>
      <Show
        when={signedIn()}
        fallback={
          <a class={styles.accountChip} href="/#/settings/account">
            <span aria-hidden="true">
              <UserRound />
            </span>
            Sign in
          </a>
        }
      >
        <div class={styles.accountChipWrap}>
          <button
            type="button"
            class={styles.accountChip}
            aria-expanded={menuOpen()}
            aria-haspopup="menu"
            title={email() !== '' ? email() : undefined}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">
              <UserRound />
            </span>
            <span class={styles.accountName}>{shortName()}</span>
            <Show when={credits() !== null}>
              <small>{credits()} cr</small>
            </Show>
          </button>
          <Show when={menuOpen()}>
            <div class={styles.accountMenu} role="menu">
              <Show when={email() !== ''}>
                <span>{email()}</span>
              </Show>
              <a href="/#/settings/credits" role="menuitem">
                Manage credits
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  signOutStandalone()
                  setMenuOpen(false)
                }}
              >
                Sign out
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  )
}
