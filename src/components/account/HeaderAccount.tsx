// ============================================================
// HeaderAccount — compact account control in the header (right slot)
// ============================================================
// Sits next to the version + Ko-fi pill. Signed in: a double-pill with the
// username (opens Settings → Account) and a sign-out icon. Signed out /
// anonymous: a "Sign in" pill that opens the same place. Hidden entirely
// when no cloud API is configured.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onMount, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { MeResponse } from '@/db/services/auth-service'
import { fetchMe, isRegisteredProvider, logout, restoreAuth, } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
import { loadFeaturedPromo, offeredPromo } from '@/stores/promo-store'
import { openAuthModal } from '@/stores/ui-store'
import styles from './HeaderAccount.module.css'

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H10c-1.1 0-2 .9-2 2v4h2V5h9v14h-9v-4H8v4c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </svg>
  )
}

// A wrapped present: lid, box, ribbon and bow. Marks the promo pill as a gift.
function GiftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      aria-hidden="true"
      data-icon="gift"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8v13" />
      <path d="M12 8C10.5 5 7 4 7 6.2 7 7.6 9.5 8 12 8z" />
      <path d="M12 8c1.5-3 5-4 5-1.8 0 1.4-2.5 1.8-5 1.8z" />
    </svg>
  )
}

export const HeaderAccount: Component = () => {
  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''
  const [me, setMe] = createSignal<MeResponse | null>(null)
  // Until the first restore+fetch lands, "Sign in" would be a guess — on a
  // slow connection the pill said it for seconds to people who were signed
  // in. A neutral probe pill holds the slot instead.
  const [authResolved, setAuthResolved] = createSignal(false)
  // Sign-out is one tap from the button people press to check who they are
  // signed in as, and it drops them out of a session mid-practice. It asks.
  const [confirming, setConfirming] = createSignal(false)

  // Re-fetch on every auth transition (sign-in from Settings, Google
  // redirect return, restored session, sign-out) — a one-shot onMount left
  // the pill saying "Sign in" while the user was actually signed in.
  createEffect(() => {
    authVersion()
    if (!cloudConfigured) return
    void (async () => {
      try {
        // Restore only — rendering the header must never provision an
        // identity, or every page load would create an account again.
        await restoreAuth()
        setMe(await fetchMe())
      } finally {
        setAuthResolved(true)
      }
    })()
  })

  // Which code is on offer is the server's call (promo-store). Asked once
  // per page load; the pill appears when the answer does.
  onMount(() => {
    void loadFeaturedPromo()
  })

  const isUpgraded = (): boolean =>
    isRegisteredProvider(me()?.user.authProvider)
  const name = (): string => {
    const n = String(me()?.profile?.displayName ?? '').trim()
    return n !== '' ? n : 'Account'
  }

  function openAccount(): void {
    // The full account UI (profile, sign-out) lives in Settings → Account.
    window.location.hash = '#/settings/account'
  }

  function openSignIn(): void {
    // Signed out: straight into the shared sign-in dialog — no detour
    // through Settings.
    openAuthModal('login')
  }

  function handleLogout(): void {
    setConfirming(false)
    logout()
    setMe(null)
    showNotification('Signed out', 'info')
  }

  return (
    <Show when={cloudConfigured}>
      <Show
        when={authResolved()}
        fallback={
          <div
            class={styles.probePill}
            role="status"
            aria-label="Checking sign-in status"
            data-testid="header-auth-probe"
          >
            <span class={styles.probeSpinner} aria-hidden="true" />
          </div>
        }
      >
        <div class={styles.accountWrapper}>
          <Show when={offeredPromo()}>
            {(promo) => (
              <a
                href="#/settings/credits"
                class={styles.promoPill}
                title={`Claim ${promo().credits} free cloud separation credits`}
                data-testid="header-promo-pill"
              >
                <GiftIcon />
                <span>Promo</span>
              </a>
            )}
          </Show>

          <Show
            when={isUpgraded()}
            fallback={
              <button
                class={styles.signInPill}
                onClick={openSignIn}
                title="Sign in"
                data-testid="header-signin"
              >
                <UserIcon />
                {/* Deliberately the same words for everyone. The chip cannot
                    know whether an account is waiting — only that this device
                    signed in once — and "Welcome back" was read as a passkey
                    having been detected, which no browser will tell us. The
                    Home strip carries the returning-visitor message, where
                    there is room to name the method it is actually offering. */}
                <span>Sign in</span>
              </button>
            }
          >
            <div class={styles.pill} data-testid="header-account">
              <button
                class={styles.nameBtn}
                onClick={openAccount}
                title="Account settings"
              >
                <UserIcon />
                <span class={styles.name}>{name()}</span>
              </button>
              <button
                class={styles.logoutBtn}
                onClick={() => setConfirming(true)}
                title="Sign out"
                aria-label="Sign out"
                data-testid="header-logout"
              >
                <SignOutIcon />
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <ConfirmDialog
        open={confirming()}
        title="Sign out?"
        message="Your practice stays on this device. While signed out you keep practicing with the device's own history; sign in again any time to see your account's history and sync."
        confirmLabel="Sign out"
        confirmIcon={<SignOutIcon />}
        onConfirm={handleLogout}
        onCancel={() => setConfirming(false)}
      />
    </Show>
  )
}
