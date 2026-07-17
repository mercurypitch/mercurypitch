// Topbar account chip + sign-in modal for Karaoke Night. Lazy-loaded so the
// auth/billing services stay out of the first-paint chunk. Uses auth-service
// directly (AccountSection is settings-shell styled — the services are the
// reusable part).
import { createSignal, onMount, Show } from 'solid-js'
import { PasswordRequirements } from '@/components/account/PasswordRequirements'
import { VerifyEmailBanner } from '@/components/account/VerifyEmailBanner'
import { googleSignInUrl, loginWithPassword, registerWithPassword, takeGoogleRedirectResult, } from '@/db/services/auth-service'
import { isPasswordValid } from '@/lib/password-policy'
import { showNotification } from '@/stores/notifications-store'
import { account, credits, knLogout, refreshAccount, signedIn, } from './karaoke-account'

export function KaraokeAccount() {
  onMount(() => {
    // Surface the outcome of a Google redirect, then reconcile the account
    // signal with whatever token is now stored.
    const g = takeGoogleRedirectResult()
    if (g !== null && !g.ok) {
      showNotification(`Google sign-in failed: ${g.error}`, 'error')
    }
    void refreshAccount()
  })

  const [modalOpen, setModalOpen] = createSignal(false)
  const [menuOpen, setMenuOpen] = createSignal(false)
  const [mode, setMode] = createSignal<'login' | 'register'>('login')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  const label = () => {
    const a = account()
    if (a === null) return 'Sign in'
    return a.email ?? 'Account'
  }

  // Live password validity (register only) — red border + checklist instead
  // of discovering the rules one server rejection at a time.
  const pwdInvalid = () =>
    mode() === 'register' && password() !== '' && !isPasswordValid(password())

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    if (mode() === 'register' && !isPasswordValid(password())) {
      setError("Password doesn't meet the requirements yet.")
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode() === 'register') {
        await registerWithPassword(email().trim(), password())
      } else {
        await loginWithPassword(email().trim(), password())
      }
      await refreshAccount()
      setModalOpen(false)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="kn-account">
      {/* Fixed-position pill — DOM placement here just rides the lazy
          account chunk; visually it floats bottom-centre of the page. */}
      <VerifyEmailBanner />
      <Show
        when={signedIn()}
        fallback={
          <button class="kn-account-chip" onClick={() => setModalOpen(true)}>
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path
                fill="currentColor"
                d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"
              />
            </svg>
            Sign in
          </button>
        }
      >
        <div class="kn-account-menu-wrap">
          <button
            class="kn-account-chip kn-account-chip--in"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span class="kn-account-dot" />
            {label()}
            <Show when={credits() !== null}>
              <span class="kn-account-credits">{credits()} cr</span>
            </Show>
          </button>
          <Show when={menuOpen()}>
            <div class="kn-account-menu">
              <a href="/#/settings/credits">Manage credits</a>
              <button
                onClick={() => {
                  knLogout()
                  setMenuOpen(false)
                }}
              >
                Sign out
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={modalOpen()}>
        <div class="kn-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div class="kn-modal" onClick={(e) => e.stopPropagation()}>
            <button
              class="kn-modal-close"
              title="Close"
              onClick={() => setModalOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </button>
            <h2>{mode() === 'register' ? 'Create your account' : 'Sign in'}</h2>
            <form onSubmit={(e) => void submit(e)}>
              <input
                type="email"
                name="email"
                id="kn-auth-email"
                placeholder="Email"
                aria-label="Email"
                autocomplete="username"
                required
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                aria-invalid={error() !== '' ? 'true' : undefined}
              />
              <input
                type="password"
                name="password"
                id="kn-auth-password"
                placeholder="Password"
                aria-label="Password"
                autocomplete={
                  mode() === 'register' ? 'new-password' : 'current-password'
                }
                required
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                aria-invalid={
                  pwdInvalid() || error() !== '' ? 'true' : undefined
                }
              />
              <Show when={mode() === 'register'}>
                <PasswordRequirements
                  password={password()}
                  showInvalid={password() !== ''}
                />
              </Show>
              <Show when={error() !== ''}>
                <p class="kn-modal-error">{error()}</p>
              </Show>
              <button
                class="kn-btn kn-btn--primary"
                type="submit"
                disabled={busy()}
              >
                {busy()
                  ? 'Please wait…'
                  : mode() === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>
            <button
              class="kn-modal-google"
              onClick={() => window.location.assign(googleSignInUrl())}
            >
              Continue with Google
            </button>
            <button
              class="kn-modal-switch"
              onClick={() => {
                setMode((m) => (m === 'login' ? 'register' : 'login'))
                setError('')
              }}
            >
              {mode() === 'login'
                ? 'New here? Create an account'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
