// ============================================================
// AccountSection — cloud account management (settings)
// ============================================================
//
// Anonymous-first: everyone gets a silent anonymous identity; this
// section lets them upgrade to email/password or Google so progress,
// challenges and leaderboard entries follow them across devices.
// Karaoke/UVR data stays on-device regardless of login state.
// Sign-in / registration itself lives in the shared AuthModal (opened
// from here and from the header pill); this section shows the state
// and manages the signed-in profile.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Match, Show, Switch } from 'solid-js'
import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import type { MeResponse } from '@/db/services/auth-service'
import { ensureAuth, fetchMe, googleSignInUrl, logout, } from '@/db/services/auth-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
import { openAuthModal } from '@/stores/ui-store'
import styles from './AccountSection.module.css'
import { GoogleMark } from './GoogleMark'

// ── Component ───────────────────────────────────────────────────

export const AccountSection: Component = () => {
  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''

  const [me, setMe] = createSignal<MeResponse | null>(null)
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [nameDraft, setNameDraft] = createSignal('')

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

  // Re-fetch on every auth transition — sign-in now happens in the shared
  // AuthModal, so this section must notice it from the outside (same
  // pattern as HeaderAccount).
  createEffect(() => {
    authVersion()
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

  function handleLogout(): void {
    logout()
    setMe(null)
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

          {/* Anonymous (or signed out) — the actual form lives in AuthModal */}
          <Match when={true}>
            <div class={styles.signedOutCard}>
              <p class={styles.signedOutLead}>
                {me() != null
                  ? 'You are practicing on an anonymous account.'
                  : 'You are signed out.'}
              </p>
              <p class={styles.mutedNote}>
                Create a free account to keep your progress, scores and credits
                across devices.
              </p>
              <div class={styles.buttonRow}>
                <button
                  class={styles.authButtonPrimary}
                  onClick={() => openAuthModal('register')}
                  data-testid="show-register"
                >
                  Create account
                </button>
                <button
                  class={styles.authButton}
                  onClick={() => openAuthModal('login')}
                  data-testid="show-login"
                >
                  Sign in
                </button>
                <button
                  class={styles.googleButton}
                  onClick={startGoogleSignIn}
                  data-testid="google-signin"
                >
                  <GoogleMark />
                  Sign in with Google
                </button>
              </div>
            </div>
          </Match>
        </Switch>
      </Show>
    </div>
  )
}
