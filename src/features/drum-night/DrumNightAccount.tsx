// The Drum Night account chip: who is signed in, and what credits remain.
// ============================================================
//
// Lazy-loaded so the auth and billing services stay out of the room's first
// paint. It reports state and delegates sign-in to the route-level host; it
// does not carry a second form or authentication state machine of its own.
// (Same contract as Guitar Night's chip — a shared component is planned once
// both rooms settle.)

import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { UserRound } from '@/components/icons'
import { accountHeld, takeGoogleRedirectResult, } from '@/db/services/auth-service'
import { account, credits, refreshAccount, signOutStandalone, } from '@/lib/standalone-account'
import { showNotification } from '@/stores/notifications-store'
import styles from './DrumNightApp.module.css'

interface DrumNightAccountProps {
  onSignIn: () => void
}

export function DrumNightAccount(props: DrumNightAccountProps) {
  const [menuOpen, setMenuOpen] = createSignal(false)
  let trigger: HTMLButtonElement | undefined

  const closeMenu = (restoreFocus = false): void => {
    if (!menuOpen()) return
    setMenuOpen(false)
    if (restoreFocus) queueMicrotask(() => trigger?.focus())
  }

  onMount(() => {
    const googleResult = takeGoogleRedirectResult()
    if (googleResult !== null && !googleResult.ok) {
      showNotification(`Google sign-in failed: ${googleResult.error}`, 'error')
    }
    void refreshAccount()
    // Any click outside closes the menu: it overlaps the stage, and a menu
    // left open over a moving room is worse than no menu.
    const closeOnOutside = (event: MouseEvent): void => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(`.${styles.accountChipWrap}`) !== null
      ) {
        return
      }
      closeMenu()
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !menuOpen()) return
      event.preventDefault()
      closeMenu(true)
    }
    window.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    onCleanup(() => {
      window.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
    })
  })

  const email = () => account()?.email ?? ''
  // The local part only: a long address would push the session bar off a phone.
  const shortName = () => {
    const full = email()
    if (full === '') return 'Account'
    const at = full.indexOf('@')
    return at > 0 ? full.slice(0, at) : full
  }

  const accessibleAccountLabel = (): string => {
    if (email() === '') return 'Open account options'
    const balance = credits()
    if (balance === null) return `Account for ${shortName()}`
    return `Account for ${shortName()}, ${balance} ${balance === 1 ? 'credit' : 'credits'} remaining`
  }

  return (
    <Show
      when={accountHeld()}
      fallback={
        <button
          type="button"
          class={styles.accountChip}
          aria-label="Sign in to MercuryPitch"
          onClick={props.onSignIn}
        >
          <span aria-hidden="true">
            <UserRound />
          </span>
          <span class={styles.accountName}>Sign in</span>
        </button>
      }
    >
      <div class={styles.accountChipWrap}>
        <button
          ref={trigger}
          type="button"
          class={styles.accountChip}
          aria-expanded={menuOpen()}
          aria-controls="drum-night-account-options"
          aria-label={accessibleAccountLabel()}
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
          <div
            id="drum-night-account-options"
            class={styles.accountMenu}
            role="group"
            aria-label="Account options"
          >
            <Show when={email() !== ''}>
              <span>{email()}</span>
            </Show>
            <a href="/#/settings/credits">Manage credits</a>
            <button
              type="button"
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
  )
}
