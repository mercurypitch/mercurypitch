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
import { getDb } from '@/db'
import type { LeaderboardEntry, UserProfile } from '@/db/entities'
import type { MeResponse } from '@/db/services/auth-service'
import { ensureAuth, fetchMe, loginWithGoogle, loginWithPassword, logout, registerWithPassword, } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
import styles from './AccountSection.module.css'

// ── Google Identity Services (GIS) ──────────────────────────────

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    /** Browser-mediated FedCM sign-in: no popup, so it keeps working
     *  under our COOP/COEP isolation headers (vite dev + _headers). */
    use_fedcm_for_button?: boolean
  }): void
  renderButton(
    parent: HTMLElement,
    options: { theme?: string; size?: string; width?: number },
  ): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript(): Promise<GoogleAccountsId | null> {
  return new Promise((resolve) => {
    const existing = window.google?.accounts?.id
    if (existing) {
      resolve(existing)
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve(window.google?.accounts?.id ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

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

  const profileName = (): string =>
    String(me()?.profile?.displayName ?? '').trim()

  // Keep the editor in sync with the loaded profile
  createEffect(() => setNameDraft(profileName()))

  /**
   * Persist the display name to the cloud profile and rename the
   * user's existing leaderboard entries to match. Google sign-in has
   * no name prompt, so this editor is how Google users pick one.
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
      try {
        await profiles.update(userId, { displayName: name })
      } catch {
        // No profile row yet — create one (cloud row id == userId)
        await profiles.create({
          displayName: name,
          joinDate: new Date().toISOString(),
          lastPracticeDate: null,
          currentStreak: 0,
        })
      }
      const leaderboard =
        db.getRepository<LeaderboardEntry>('leaderboardEntries')
      const mine = await leaderboard.findAll({ where: { userId } })
      await Promise.all(
        mine.map((entry) =>
          leaderboard.update(entry.id, { displayName: name }),
        ),
      )
      await refreshMe()
      showNotification('Display name updated', 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  let googleButtonHost: HTMLDivElement | undefined
  let gis: GoogleAccountsId | null = null

  async function refreshMe(): Promise<void> {
    setMe(await fetchMe())
  }

  // (Re-)render the Google button into a host element. The host div is
  // recreated whenever the anonymous view remounts (cancelling the
  // email form, signing out), so this runs from its ref each time.
  function renderGoogleButton(host: HTMLElement): void {
    if (gis == null) return
    host.innerHTML = ''
    gis.renderButton(host, { theme: 'outline', size: 'large' })
  }

  onMount(() => {
    if (!cloudConfigured) return
    void (async () => {
      await ensureAuth()
      await refreshMe()

      if (GOOGLE_CLIENT_ID === '') return
      gis = await loadGisScript()
      if (gis == null) return
      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        use_fedcm_for_button: true,
        callback: (response) => {
          void handleAuthAction(async () => {
            await loginWithGoogle(response.credential)
            showNotification('Signed in with Google', 'info')
          })
        },
      })
      if (googleButtonHost != null && googleButtonHost.isConnected) {
        renderGoogleButton(googleButtonHost)
      }
    })()
  })

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
    if (mode() === 'register') {
      void handleAuthAction(async () => {
        await registerWithPassword(email(), password(), displayName())
        showNotification('Account created — progress is now synced', 'info')
      })
    } else {
      void handleAuthAction(async () => {
        await loginWithPassword(email(), password())
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
            <div class={styles.statusRow}>
              <span class={styles.providerBadge}>{provider()}</span>
              <span class={styles.userEmail} data-testid="account-display-name">
                {profileName() !== '' ? profileName() : 'Signed in'}
              </span>
              <span class={styles.mutedNote} data-testid="account-email">
                {me()?.user.email ?? ''}
              </span>
            </div>
            <div class={styles.nameEditRow}>
              <input
                class={styles.authInput}
                type="text"
                placeholder="Display name"
                maxLength={40}
                value={nameDraft()}
                onInput={(e) => setNameDraft(e.currentTarget.value)}
                data-testid="display-name-input"
              />
              <button
                class={styles.authButton}
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
            <p class={styles.mutedNote}>
              Your display name appears on leaderboards and shared content.
              Challenges, scores and leaderboard entries sync with this account.
              Karaoke audio stays on this device.
            </p>
            <Show when={error() !== ''}>
              <p class={styles.errorNote} data-testid="auth-error">
                {error()}
              </p>
            </Show>
            <div class={styles.buttonRow}>
              <button
                class={styles.authButton}
                onClick={handleLogout}
                data-testid="logout-button"
              >
                Sign out
              </button>
            </div>
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
            <div
              ref={(el) => {
                googleButtonHost = el
                renderGoogleButton(el)
              }}
              class={styles.googleButtonHost}
            />
          </Match>

          {/* Login / register form */}
          <Match when={mode() !== 'none'}>
            <form class={styles.authForm} onSubmit={handleSubmit}>
              <Show when={mode() === 'register'}>
                <input
                  class={styles.authInput}
                  type="text"
                  placeholder="Display name (optional)"
                  value={displayName()}
                  onInput={(e) => setDisplayName(e.currentTarget.value)}
                  data-testid="auth-display-name"
                />
              </Show>
              <input
                class={styles.authInput}
                type="email"
                placeholder="Email"
                required
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                data-testid="auth-email"
              />
              <input
                class={styles.authInput}
                type="password"
                placeholder={
                  mode() === 'register'
                    ? 'Password (min 8 characters)'
                    : 'Password'
                }
                required
                minLength={mode() === 'register' ? 8 : undefined}
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                data-testid="auth-password"
              />
              <Show when={error() !== ''}>
                <p class={styles.errorNote} data-testid="auth-error">
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
    </div>
  )
}
