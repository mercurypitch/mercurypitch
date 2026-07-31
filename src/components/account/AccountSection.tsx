// ============================================================
// AccountSection — cloud account management (settings)
// ============================================================
//
// An identity is created lazily — the first thing worth saving provisions
// it — and this section lets it be upgraded to email/password or Google so
// progress, challenges and leaderboard entries follow the user across
// devices. Karaoke/UVR data stays on-device regardless of login state.
// Sign-in / registration itself lives in the shared AuthModal (opened
// from here and from the header pill); this section shows the state,
// manages the signed-in profile, and can erase an account outright.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Match, Show, Switch } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import type { MeResponse } from '@/db/services/auth-service'
import { deleteAccount, fetchMe, googleSignInUrl, logout, restoreAuth, } from '@/db/services/auth-service'
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
  const [confirmDelete, setConfirmDelete] = createSignal(false)

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

  const optIn = (): boolean => me()?.profile?.leaderboardOptIn === true

  /** Persist public-board consent. Writes straight to the owned profile row. */
  async function setLeaderboardOptIn(next: boolean): Promise<void> {
    setError('')
    setBusy(true)
    try {
      const db = await getDb()
      const profiles = db.getRepository<UserProfile>('userProfiles')
      await profiles.update(getUserId(), {
        leaderboardOptIn: next,
        leaderboardOptInAt: next ? new Date().toISOString() : null,
      })
      await refreshMe()
      showNotification(
        next
          ? 'You’re on the public leaderboard'
          : 'Removed from the public leaderboard',
        'info',
      )
    } catch (err) {
      // Re-read the profile so the checkbox snaps back to the stored value —
      // checked={optIn()} does not re-render on a failed write by itself,
      // and a checkbox lying about consent is the one state this section
      // must never show.
      await refreshMe().catch(() => undefined)
      const raw = err instanceof Error ? err.message : String(err)
      setError(
        raw.includes('no cloud identity')
          ? 'Sign in to change your leaderboard listing.'
          : raw,
      )
    } finally {
      setBusy(false)
    }
  }

  // Re-fetch on every auth transition — sign-in now happens in the shared
  // AuthModal, so this section must notice it from the outside (same
  // pattern as HeaderAccount).
  createEffect(() => {
    authVersion()
    if (!cloudConfigured) return
    void (async () => {
      // Restore only: opening Settings → Account is not an action worth
      // an account. With no session this shows the signed-out state.
      await restoreAuth()
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

  async function handleDeleteAccount(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await deleteAccount()
      setMe(null)
      setConfirmDelete(false)
      showNotification('Account deleted', 'info')
      // Reload rather than carry on in a page still holding the deleted
      // account's state: stores keep its streak/profile in memory, and a
      // debounced settings push landing after the delete would provision a
      // fresh account seconds later. Same full reset as "clear storage".
      // The delay lets the confirmation land before the page goes.
      setTimeout(() => {
        window.location.href = '/'
      }, 900)
    } catch (err) {
      // Close the dialog but surface the failure loudly in the section —
      // silently "succeeding" would tell someone their data is gone when it
      // is still there.
      setError(err instanceof Error ? err.message : 'Could not delete account')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
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

        {/* Public-board consent. Qualifying on activity is necessary but not
            sufficient — nothing is published until this is on. */}
        <Show when={me() != null}>
          <div class={styles.accountField}>
            <label class={styles.optInRow}>
              <input
                type="checkbox"
                checked={optIn()}
                disabled={busy()}
                data-testid="leaderboard-optin"
                onChange={(e) =>
                  void setLeaderboardOptIn(e.currentTarget.checked)
                }
              />
              <span>Show me on the public leaderboard</span>
            </label>
            <p class={styles.fieldHint}>
              Off by default. Exercise and challenge results rank once you've
              practised a few days running; free practice and your streak are
              never published. Friends you add see more.
            </p>
          </div>
        </Show>

        {/* Erasure is offered whenever a server identity exists — anonymous
            accounts hold streaks, scores and settings too, and GDPR doesn't
            care whether you ever typed an email. */}
        <Show when={me() != null}>
          <div class={styles.dangerZone}>
            <button
              class={styles.dangerButton}
              onClick={() => setConfirmDelete(true)}
              disabled={busy()}
              data-testid="delete-account"
            >
              Delete account
            </button>
            <p class={styles.mutedNote}>
              Permanently erases your profile, scores, streaks, badges and
              settings from our servers. Unspent credits are lost. Files on this
              device are not affected.
            </p>
          </div>
        </Show>
      </Show>

      <ConfirmDialog
        open={confirmDelete()}
        title="Delete account"
        message={
          <>
            This permanently erases your profile, scores, streaks, badges,
            settings and any unspent credits from our servers.{' '}
            <strong>It cannot be undone.</strong>
          </>
        }
        confirmLabel="Delete forever"
        confirmPhrase="delete"
        busy={busy()}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
