// ============================================================
// AccountSection — cloud account management (settings)
// ============================================================
//
// Anonymous-first: everyone gets a silent anonymous identity; this
// section lets them upgrade to email/password or Google so progress,
// challenges and leaderboard entries follow them across devices.
// Karaoke/UVR data stays on-device regardless of login state.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Match, onMount, Show, Switch, } from 'solid-js'
import { PricingPanel } from '@/components/billing/PricingPanel'
import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import type { MeResponse } from '@/db/services/auth-service'
import { ensureAuth, fetchMe, googleSignInUrl, loginWithPassword, logout, registerWithPassword, } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
import styles from './AccountSection.module.css'

// ── Component ───────────────────────────────────────────────────

type FormMode = 'none' | 'login' | 'register'

export const AccountSection: Component = () => {
  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''

  const [me, setMe] = createSignal<MeResponse | null>(null)
  const [mode, setMode] = createSignal<FormMode>('none')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [displayName, setDisplayName] = createSignal('')
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [nameDraft, setNameDraft] = createSignal('')
  const [showPlans, setShowPlans] = createSignal(false)

  const profileName = (): string =>
    String(me()?.profile?.displayName ?? '').trim()

  // Keep the editor in sync with the loaded profile
  createEffect(() => setNameDraft(profileName()))

  /**
   * Persist the display name to the cloud profile. The leaderboard reads
   * names from the profile, so no separate update is needed. Google sign-in
   * has no name prompt, so this editor is how Google users pick one.
   */
  async function saveDisplayName(): Promise<void> {
    const name = nameDraft().trim()
    if (name === '' || name === profileName()) return
    setError('')
    setBusy(true)
    try {
      const db = await getDb()
      const profiles = db.getRepository<UserProfile>('userProfiles')
      const userId = getUserId()
      // Cloud row id == userId (the JWT identity)
      if ((await profiles.findById(userId)) != null) {
        await profiles.update(userId, { displayName: name })
      } else {
        await profiles.create({
          displayName: name,
          joinDate: new Date().toISOString(),
          lastPracticeDate: null,
          currentStreak: 0,
        })
      }
      // The leaderboard is server-derived from sessionRecords and pulls the
      // display name from userProfiles, so updating the profile above is
      // enough — there is no client-writable leaderboardEntries table.
      await refreshMe()
      showNotification('Display name updated', 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function refreshMe(): Promise<void> {
    setMe(await fetchMe())
  }

  onMount(() => {
    if (!cloudConfigured) return
    void (async () => {
      await ensureAuth()
      await refreshMe()
    })()
  })

  /** Full-page redirect via the worker: COOP severs window.opener, so
   *  the GIS popup flow cannot work here (see auth-service). */
  function startGoogleSignIn(): void {
    window.location.assign(googleSignInUrl())
  }

  async function handleAuthAction(action: () => Promise<void>): Promise<void> {
    setError('')
    setBusy(true)
    try {
      await action()
      setMode('none')
      setPassword('')
      await refreshMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: Event): void {
    e.preventDefault()
    // Snapshot the form inside the event handler — the async closures
    // below run outside the tracked scope (and the form could change
    // mid-request).
    const credentials = { email: email(), password: password() }
    if (mode() === 'register') {
      const name = displayName()
      void handleAuthAction(async () => {
        await registerWithPassword(
          credentials.email,
          credentials.password,
          name,
        )
        showNotification('Account created — progress is now synced', 'info')
      })
    } else {
      void handleAuthAction(async () => {
        await loginWithPassword(credentials.email, credentials.password)
        showNotification('Signed in', 'info')
      })
    }
  }

  function handleLogout(): void {
    logout()
    setMe(null)
    setMode('none')
    showNotification('Signed out', 'info')
  }

  const provider = (): string => me()?.user.authProvider ?? 'anonymous'
  const isUpgraded = (): boolean =>
    provider() === 'password' || provider() === 'google'

  return (
    <div class={styles.accountSection} data-testid="account-section">
      <Show
        when={cloudConfigured}
        fallback={
          <p class={styles.mutedNote}>
            Cloud accounts are not available in this build (no API configured).
            Your data is stored on this device.
          </p>
        }
      >
        <Switch>
          {/* Signed in with a real account */}
          <Match when={me() != null && isUpgraded()}>
            <div class={styles.accountCard}>
              <span class={styles.accountType}>
                Signed in with {provider() === 'google' ? 'Google' : 'email'}
              </span>
              <div class={styles.accountIdentity}>
                <span
                  class={styles.displayNamePill}
                  data-testid="account-display-name"
                >
                  {profileName() !== '' ? profileName() : 'Signed in'}
                </span>
                <div class={styles.identityRight}>
                  <span class={styles.emailValue} data-testid="account-email">
                    {me()?.user.email ?? ''}
                  </span>
                  <button
                    class={styles.iconButton}
                    onClick={handleLogout}
                    data-testid="logout-button"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H10c-1.1 0-2 .9-2 2v4h2V5h9v14h-9v-4H8v4c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div class={styles.accountField}>
                <label
                  class={styles.fieldLabel}
                  for="account-display-name-input"
                >
                  Display name
                </label>
                <div class={styles.nameEditRow}>
                  <input
                    id="account-display-name-input"
                    class={styles.authInput}
                    type="text"
                    placeholder="Display name"
                    aria-label="Display name"
                    autocomplete="nickname"
                    maxLength={40}
                    value={nameDraft()}
                    onInput={(e) => setNameDraft(e.currentTarget.value)}
                    data-testid="display-name-input"
                  />
                  <button
                    class={styles.authButtonPrimary}
                    onClick={() => void saveDisplayName()}
                    disabled={
                      busy() ||
                      nameDraft().trim() === '' ||
                      nameDraft().trim() === profileName()
                    }
                    data-testid="display-name-save"
                  >
                    Save
                  </button>
                </div>
                <p class={styles.fieldHint}>
                  Shown on leaderboards and shared content.
                </p>
              </div>
            </div>
            <p class={styles.mutedNote}>
              Challenges, scores and leaderboard entries sync with this account.
              Karaoke audio stays on this device.
            </p>
            <Show when={error() !== ''}>
              <p class={styles.errorNote} data-testid="auth-error">
                {error()}
              </p>
            </Show>
          </Match>

          {/* Anonymous (or signed out) */}
          <Match when={mode() === 'none'}>
            <p class={styles.mutedNote}>
              {me() != null
                ? 'You are using an anonymous account. Create an account to keep your progress across devices.'
                : 'Sign in to sync your progress across devices.'}
            </p>
            <div class={styles.buttonRow}>
              <button
                class={styles.authButtonPrimary}
                onClick={() => setMode('register')}
                data-testid="show-register"
              >
                Create account
              </button>
              <button
                class={styles.authButton}
                onClick={() => setMode('login')}
                data-testid="show-login"
              >
                Sign in
              </button>
            </div>
            <button
              class={styles.googleButton}
              onClick={startGoogleSignIn}
              data-testid="google-signin"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Sign in with Google
            </button>
            <Show when={error() !== ''}>
              <p class={styles.errorNote} data-testid="auth-error">
                {error()}
              </p>
            </Show>
          </Match>

          {/* Login / register form */}
          <Match when={mode() !== 'none'}>
            <form class={styles.authForm} onSubmit={handleSubmit}>
              <Show when={mode() === 'register'}>
                <input
                  class={styles.authInput}
                  type="text"
                  placeholder="Display name (optional)"
                  aria-label="Display name"
                  autocomplete="nickname"
                  value={displayName()}
                  onInput={(e) => setDisplayName(e.currentTarget.value)}
                  data-testid="auth-display-name"
                />
              </Show>
              <input
                class={styles.authInput}
                type="email"
                name="email"
                id="auth-email"
                placeholder="Email"
                aria-label="Email"
                autocomplete="username"
                required
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                aria-invalid={error() !== '' ? 'true' : undefined}
                aria-describedby={error() !== '' ? 'auth-error' : undefined}
                data-testid="auth-email"
              />
              <input
                class={styles.authInput}
                type="password"
                name="password"
                id="auth-password"
                placeholder={
                  mode() === 'register'
                    ? 'Password (min 8 characters)'
                    : 'Password'
                }
                aria-label="Password"
                autocomplete={
                  mode() === 'register' ? 'new-password' : 'current-password'
                }
                required
                minLength={mode() === 'register' ? 8 : undefined}
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                aria-invalid={error() !== '' ? 'true' : undefined}
                aria-describedby={error() !== '' ? 'auth-error' : undefined}
                data-testid="auth-password"
              />
              <Show when={error() !== ''}>
                <p
                  class={styles.errorNote}
                  id="auth-error"
                  role="alert"
                  data-testid="auth-error"
                >
                  {error()}
                </p>
              </Show>
              <div class={styles.buttonRow}>
                <button
                  class={styles.authButtonPrimary}
                  type="submit"
                  disabled={busy()}
                  data-testid="auth-submit"
                >
                  {mode() === 'register' ? 'Create account' : 'Sign in'}
                </button>
                <button
                  class={styles.authButton}
                  type="button"
                  onClick={() => {
                    setMode('none')
                    setError('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Match>
        </Switch>
      </Show>

      {/* Plans & credits — server-side separation is the only paid axis;
          on-device stays free. Pricing shows "Soon" until it's wired. */}
      <div class={styles.buttonRow}>
        <button
          class={styles.authButton}
          onClick={() => setShowPlans((v) => !v)}
          data-testid="toggle-plans"
        >
          {showPlans() ? 'Hide plans' : 'Plans & credits'}
        </button>
      </div>
      <Show when={showPlans()}>
        <PricingPanel />
      </Show>
    </div>
  )
}
