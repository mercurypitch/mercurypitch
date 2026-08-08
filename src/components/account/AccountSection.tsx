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
import { SupporterBadge } from '@/components/billing/SupporterBadge'
import { Pencil } from '@/components/icons'
import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import type { MeResponse } from '@/db/services/auth-service'
import { fetchMe, googleSignInUrl, logout, restoreAuth, } from '@/db/services/auth-service'
import { fetchBillingMe, supporterEntitlement, supporterPlanId, } from '@/db/services/billing-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { CONTACT_EMAIL, GITHUB_NEW_ISSUE_URL } from '@/lib/contact-links'
import { API_BASE_URL } from '@/lib/defaults'
import { useSupporterFeatures } from '@/lib/use-supporter-features'
import { showNotification } from '@/stores/notifications-store'
import { openAuthModal, openFeedbackSurvey } from '@/stores/ui-store'
import styles from './AccountSection.module.css'
import { GoogleMark } from './GoogleMark'
import { VoiceSection } from './VoiceSection'

// ── Component ───────────────────────────────────────────────────

type SupporterGrant = NonNullable<ReturnType<typeof supporterEntitlement>>

export const AccountSection: Component = () => {
  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''

  const [me, setMe] = createSignal<MeResponse | null>(null)
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [nameDraft, setNameDraft] = createSignal('')
  // Supporter status rides along with the account fetch — it is the same
  // round trip the header already makes, and drives the badge below.
  const [supporter, setSupporter] = createSignal<SupporterGrant | null>(null)
  // Server-held feature perks: the admin-console shortcut is assigned to the
  // Founders supporter group, so everyone else never sees the link.
  const features = useSupporterFeatures()

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
    setSupporter(supporterEntitlement(await fetchBillingMe()))
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
    setSupporter(null)
    showNotification('Signed out', 'info')
  }

  const provider = (): string => me()?.user.authProvider ?? 'anonymous'
  const isUpgraded = (): boolean =>
    provider() === 'password' || provider() === 'google'
  const isTestAccount = (): boolean => me()?.user.isTestAccount === true
  const testAccountExpiry = (): string => {
    const value = me()?.user.testAccountExpiresAt
    if (value == null) return ''
    const parsed = new Date(value)
    if (!Number.isFinite(parsed.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
  }

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
                {isTestAccount()
                  ? 'Managed test account'
                  : `Signed in with ${provider() === 'google' ? 'Google' : 'email'}`}
              </span>
              <div class={styles.accountIdentity}>
                <span
                  class={styles.displayNamePill}
                  data-testid="account-display-name"
                >
                  {profileName() !== '' ? profileName() : 'Signed in'}
                </span>
                <Show when={isTestAccount()}>
                  <span
                    class={styles.testAccountPill}
                    data-testid="test-account-pill"
                  >
                    Test account
                  </span>
                </Show>
                <Show when={supporter()}>
                  {(grant) => (
                    <span data-testid="account-supporter-pill">
                      <SupporterBadge
                        planId={supporterPlanId(grant())}
                        label={grant().sourceLabel}
                        expiresAt={grant().expiresAt}
                      />
                    </span>
                  )}
                </Show>
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
              <Show when={isTestAccount() && testAccountExpiry() !== ''}>
                <p class={styles.testAccountNote}>
                  Campaign access expires {testAccountExpiry()}. Purchases are
                  disabled for this account.
                </p>
              </Show>

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

              {/* Founders group perk: a shortcut into the Content Studio, so
                  the console does not have to be reached by typed URL. The
                  studio itself still asks for the admin key. */}
              <Show when={features.hasFeature('admin-console')}>
                <div class={styles.accountField}>
                  <span class={styles.fieldLabel}>Founder tools</span>
                  <a
                    class={styles.adminConsoleLink}
                    href="#/admin"
                    data-testid="admin-console-link"
                  >
                    <Pencil size={15} />
                    Open the admin console
                  </a>
                  <p class={styles.fieldHint}>
                    The Content Studio unlocks with the admin key.
                  </p>
                </div>
              </Show>
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

        {/* Account erasure lives in the Danger Zone card below (see
            DeleteAccountRow) with the other destructive actions. */}
      </Show>

      {/* The other half of onboarding's promise: what an account keeps. */}
      <VoiceSection signedIn={isUpgraded()} />
      {/* Say hello — outside the cloud-configured gate on purpose: reaching a
          human never depended on having an account. */}
      <div class={styles.helloBlock} data-testid="say-hello">
        <span class={styles.helloTitle}>Say hello</span>
        <p class={styles.helloText}>
          Questions, ideas, or something broken? We read everything.
        </p>
        <div class={styles.helloLinks}>
          {/* First, because it is the only one that costs nothing to use:
              anonymous, no account, no email address revealed. */}
          <button
            class={styles.helloLink}
            type="button"
            onClick={openFeedbackSurvey}
            data-testid="say-hello-feedback"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h10v2H7V9zm6 5H7v-2h6v2zm4-6H7V6h10v2z"
              />
            </svg>
            Share feedback
          </button>
          <a
            class={styles.helloLink}
            href={`mailto:${CONTACT_EMAIL}`}
            data-testid="say-hello-email"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
              />
            </svg>
            Email us
          </a>
          <a
            class={styles.helloLink}
            href={GITHUB_NEW_ISSUE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="say-hello-issue"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              />
            </svg>
            Report a bug
          </a>
          <a
            class={styles.helloLink}
            href="#/settings/credits"
            data-testid="say-hello-support"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            Support the project
          </a>
        </div>
      </div>
    </div>
  )
}
