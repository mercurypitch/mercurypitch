// ============================================================
// ReturningSignIn — one quiet line for somebody who has been here before
// ============================================================
//
// The app works signed out, so there is no login screen to put this on. The
// cost of that is a returning visitor on a new session having no obvious way
// back into their own account short of finding Settings.
//
// It is deliberately NOT a detector. No browser API can say "this person has a
// passkey here" — see lib/last-sign-in.ts — so this reads a first-party note
// this device wrote the last time somebody signed in, and offers that same
// method back. The note holds the method and nothing else: no name, no
// address, so a shared laptop tells the next person nothing.
//
// Four conditions, all required, because each one is a way this could become a
// nag: the cloud has to exist, the visitor has to be signed out, onboarding has
// to be finished (a first-time visitor is never asked to sign in to something
// they have not used yet), and this device has to have signed in before. Plus a
// dismissal that is permanent.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { Key, X } from '@/components/icons'
import { signInWithPasskey } from '@/db/services/auth-passkey-service'
import type { MeResponse } from '@/db/services/auth-service'
import { fetchMe, restoreAuth } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { googleSignInPending, googleSignInUnavailableReason, startGoogleSignIn, } from '@/lib/google-sign-in'
import type { SignInMethod } from '@/lib/last-sign-in'
import { dismissReturningPrompt, lastSignInMethod, returningPromptDismissed, signInMethodLabel, } from '@/lib/last-sign-in'
import { describeWebAuthnError } from '@/lib/webauthn'
import { showNotification } from '@/stores/notifications-store'
import { isFirstRun } from '@/stores/onboarding-store'
import { openAuthModal } from '@/stores/ui-store'
import { GoogleMark } from './GoogleMark'
import styles from './ReturningSignIn.module.css'

export const ReturningSignIn: Component = () => {
  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''
  const [me, setMe] = createSignal<MeResponse | null>(null)
  const [resolved, setResolved] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  const method = (): SignInMethod | '' => lastSignInMethod()

  /**
   * The conditions this device can answer on its own, with no network.
   *
   * Checked first because they are false for almost everybody — a first-time
   * visitor, a device that has never signed in — and asking the server who we
   * are before checking them would put two round-trips on every Home load to
   * decide not to render anything.
   */
  const eligible = (): boolean =>
    cloudConfigured &&
    // Never before somebody has actually used the app. A sign-in prompt on a
    // first visit is asking for an account before there is anything to keep.
    !isFirstRun() &&
    method() !== '' &&
    !returningPromptDismissed()

  createEffect(() => {
    authVersion()
    if (!eligible()) return
    void (async () => {
      try {
        // Restore only. Rendering Home must never provision an identity.
        await restoreAuth()
        setMe(await fetchMe())
      } catch {
        setMe(null)
      } finally {
        setResolved(true)
      }
    })()
  })

  const provider = (): string => me()?.user.authProvider ?? 'anonymous'
  const signedIn = (): boolean =>
    provider() === 'password' || provider() === 'google'

  const visible = (): boolean => eligible() && resolved() && !signedIn()

  async function act(): Promise<void> {
    const current = method()
    if (current === '' || busy()) return
    setBusy(true)
    setError('')
    try {
      if (current === 'passkey') {
        // A press, so the system dialog opening now is expected. This is the
        // one place a non-conditional get() is correct.
        await signInWithPasskey()
        showNotification('Signed in', 'info')
      } else if (current === 'google') {
        const failure = await startGoogleSignIn()
        if (failure !== null) setError(failure)
      } else {
        // Password and mailed code both need a form, and the modal already is
        // that form — including the pane that asks for a code.
        openAuthModal('login')
      }
    } catch (err) {
      const message = describeWebAuthnError(err)
      if (message !== '') setError(message)
    } finally {
      setBusy(false)
    }
  }

  const googleBlocked = (): boolean =>
    method() === 'google' && googleSignInUnavailableReason !== null

  return (
    <Show when={visible()}>
      <div class={styles.strip} data-testid="returning-signin">
        <span class={styles.icon} aria-hidden="true">
          <Show when={method() === 'google'} fallback={<Key />}>
            <GoogleMark />
          </Show>
        </span>

        <span class={styles.text}>
          <span class={styles.title}>Welcome back</span>
          <Show
            when={error() === ''}
            fallback={
              <span class={styles.error} data-testid="returning-signin-error">
                {error()}
              </span>
            }
          >
            <span class={styles.sub}>
              Your progress and credits are on your account.
            </span>
          </Show>
        </span>

        <Show when={!googleBlocked()}>
          <button
            type="button"
            class={styles.action}
            disabled={busy() || googleSignInPending()}
            onClick={() => void act()}
            data-testid="returning-signin-action"
          >
            {busy() || googleSignInPending()
              ? 'Just a moment…'
              : signInMethodLabel(method() as SignInMethod)}
          </button>
        </Show>

        {/* Always offered: the remembered method is a guess, and somebody who
            has since changed how they sign in must not be cornered by it. */}
        <button
          type="button"
          class={styles.altAction}
          onClick={() => openAuthModal('login')}
          data-testid="returning-signin-other"
        >
          Another way
        </button>

        <button
          type="button"
          class={styles.dismiss}
          aria-label="Dismiss"
          title="Dismiss"
          onClick={() => dismissReturningPrompt()}
          data-testid="returning-signin-dismiss"
        >
          <X />
        </button>
      </div>
    </Show>
  )
}
