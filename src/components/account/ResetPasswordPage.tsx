// ============================================================
// ResetPasswordPage — #/reset-password[?token=…] full-screen overlay
// ============================================================
//
// Where the emailed reset link lands. With a token: probe its validity
// (non-consuming GET), then let the user choose a new password — success
// revokes every session server-side, so the page hands off to the sign-in
// modal instead of auto-logging-in. Without a token: the bare
// request-a-link form (linked from support / the Karaoke Night page).
// Mounted keyed on the route object, so every navigation gets a fresh
// state machine.

import type { Component } from 'solid-js'
import { createSignal, createUniqueId, Match, onMount, Show, Switch, } from 'solid-js'
import { CheckCircle, Eye, EyeOff, X } from '@/components/icons'
import { checkResetToken, requestPasswordReset, resetPassword, } from '@/db/services/auth-service'
import { isPasswordValid } from '@/lib/password-policy'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { openAuthModal } from '@/stores/ui-store'
import { PasswordRequirements } from './PasswordRequirements'
import styles from './ResetPasswordPage.module.css'

interface ResetPasswordPageProps {
  /** Token from the emailed link; null opens the request-a-link form. */
  token: string | null
  onClose: () => void
}

type View =
  | 'checking'
  | 'ready'
  | 'invalid'
  | 'done'
  | 'request'
  | 'request-sent'

// The db-worker's uniform dead-token message (auth.ts RESET_LINK_DEAD).
// Matching it lets the form swap to the "request a new link" view instead
// of showing a form that can never succeed. Keep the two in sync.
const RESET_LINK_DEAD = 'This reset link is invalid or has expired'

export const ResetPasswordPage: Component<ResetPasswordPageProps> = (props) => {
  let cardRef: HTMLDivElement | undefined
  const titleId = createUniqueId()

  // Static-by-design: the App mounts this keyed on the route object, so a
  // new token remounts the component rather than mutating this prop.
  // eslint-disable-next-line solid/reactivity
  const [view, setView] = createSignal<View>(
    props.token != null ? 'checking' : 'request',
  )
  const [password, setPassword] = createSignal('')
  const [confirm, setConfirm] = createSignal('')
  const [showPassword, setShowPassword] = createSignal(false)
  const [email, setEmail] = createSignal('')
  const [sentTo, setSentTo] = createSignal('')
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)

  useFocusTrap(() => cardRef, {
    isOpen: () => true,
    onClose: () => props.onClose(),
    initialFocus: () => cardRef?.querySelector('input') ?? undefined,
  })

  onMount(() => {
    const token = props.token
    if (token == null) return
    void (async () => {
      try {
        setView((await checkResetToken(token)) ? 'ready' : 'invalid')
      } catch {
        // Probe unreachable (network blip) — show the form and let the
        // actual reset request be the authority.
        setView('ready')
      }
    })()
  })

  const pwdInvalid = (): boolean =>
    password() !== '' && !isPasswordValid(password())

  function submitNewPassword(e: Event): void {
    e.preventDefault()
    if (busy()) return
    const token = props.token
    if (token == null) return
    const pw = password()
    if (!isPasswordValid(pw)) {
      setError("Password doesn't meet the requirements yet.")
      return
    }
    if (pw !== confirm()) {
      setError('Passwords do not match')
      return
    }
    void (async () => {
      setError('')
      setBusy(true)
      try {
        await resetPassword(token, pw)
        setView('done')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message === RESET_LINK_DEAD) {
          setView('invalid')
        } else {
          setError(message)
        }
      } finally {
        setBusy(false)
      }
    })()
  }

  function submitRequest(e: Event): void {
    e.preventDefault()
    if (busy()) return
    const address = email().trim()
    void (async () => {
      setError('')
      setBusy(true)
      try {
        await requestPasswordReset(address)
        setSentTo(address)
        setView('request-sent')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    })()
  }

  function signIn(): void {
    props.onClose()
    openAuthModal('login')
  }

  return (
    <div class={styles.overlay} data-testid="reset-password-page">
      <div
        ref={cardRef}
        class={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy() ? true : undefined}
      >
        <div class={styles.brandRow}>
          <span class={styles.brand} aria-hidden="true">
            <span class={styles.brandMercury}>Mercury</span>
            <span class={styles.brandPitch}>Pitch</span>
          </span>
          <button
            type="button"
            class={styles.close}
            onClick={() => props.onClose()}
            aria-label="Back to the app"
            title="Back to the app"
            data-testid="reset-close"
          >
            <X />
          </button>
        </div>

        <Switch>
          <Match when={view() === 'checking'}>
            <h1 id={titleId} class={styles.title}>
              Reset your password
            </h1>
            <p class={styles.sub}>Checking your reset link…</p>
          </Match>

          <Match when={view() === 'invalid'}>
            <h1 id={titleId} class={styles.title}>
              Reset your password
            </h1>
            <p class={styles.sub} data-testid="reset-invalid">
              This reset link is invalid or has expired. Links last 2 hours and
              can be used once.
            </p>
            <button
              type="button"
              class={styles.submit}
              onClick={() => {
                setError('')
                setView('request')
              }}
            >
              Request a new link
            </button>
          </Match>

          <Match when={view() === 'ready'}>
            <h1 id={titleId} class={styles.title}>
              Choose a new password
            </h1>
            <p class={styles.sub}>
              Almost there — pick a new password for your account.
            </p>
            <form class={styles.form} onSubmit={submitNewPassword}>
              <label class={styles.field}>
                <span class={styles.fieldLabel}>New password</span>
                <div class={styles.passwordField}>
                  <input
                    class={styles.input}
                    type={showPassword() ? 'text' : 'password'}
                    placeholder="8+ characters, a letter and a number"
                    autocomplete="new-password"
                    required
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    aria-invalid={
                      pwdInvalid() || error() !== '' ? 'true' : undefined
                    }
                    aria-describedby={
                      error() !== '' ? 'reset-error' : undefined
                    }
                    data-testid="reset-password-input"
                  />
                  <button
                    class={styles.revealButton}
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword() ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword()}
                    title={showPassword() ? 'Hide password' : 'Show password'}
                  >
                    <Show when={showPassword()} fallback={<Eye />}>
                      <EyeOff />
                    </Show>
                  </button>
                </div>
              </label>
              <PasswordRequirements
                password={password()}
                showInvalid={password() !== ''}
              />
              <label class={styles.field}>
                <span class={styles.fieldLabel}>Confirm new password</span>
                <input
                  class={styles.input}
                  type={showPassword() ? 'text' : 'password'}
                  placeholder="Repeat the new password"
                  autocomplete="new-password"
                  required
                  value={confirm()}
                  onInput={(e) => setConfirm(e.currentTarget.value)}
                  aria-describedby={error() !== '' ? 'reset-error' : undefined}
                  data-testid="reset-confirm-input"
                />
              </label>
              <Show when={error() !== ''}>
                <p
                  class={styles.errorNote}
                  id="reset-error"
                  role="alert"
                  data-testid="reset-error"
                >
                  {error()}
                </p>
              </Show>
              <button
                class={styles.submit}
                type="submit"
                disabled={busy()}
                data-testid="reset-submit"
              >
                {busy() ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </Match>

          <Match when={view() === 'done'}>
            <div class={styles.doneState} data-testid="reset-done">
              <span class={styles.doneIcon} aria-hidden="true">
                <CheckCircle />
              </span>
              <h1 id={titleId} class={styles.title}>
                Password updated
              </h1>
              <p class={styles.sub}>
                For safety, every signed-in session was signed out. Sign in with
                your new password to pick up where you left off.
              </p>
              <button
                type="button"
                class={styles.submit}
                onClick={signIn}
                data-testid="reset-signin"
              >
                Sign in
              </button>
            </div>
          </Match>

          <Match when={view() === 'request'}>
            <h1 id={titleId} class={styles.title}>
              Reset your password
            </h1>
            <p class={styles.sub}>
              Enter your account email and we&apos;ll send you a link to choose
              a new password.
            </p>
            <form class={styles.form} onSubmit={submitRequest}>
              <label class={styles.field}>
                <span class={styles.fieldLabel}>Email</span>
                <input
                  class={styles.input}
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="username"
                  required
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  aria-invalid={error() !== '' ? 'true' : undefined}
                  aria-describedby={error() !== '' ? 'reset-error' : undefined}
                  data-testid="reset-email-input"
                />
              </label>
              <Show when={error() !== ''}>
                <p
                  class={styles.errorNote}
                  id="reset-error"
                  role="alert"
                  data-testid="reset-error"
                >
                  {error()}
                </p>
              </Show>
              <button
                class={styles.submit}
                type="submit"
                disabled={busy()}
                data-testid="reset-request-submit"
              >
                {busy() ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </Match>

          <Match when={view() === 'request-sent'}>
            <div class={styles.doneState} data-testid="reset-request-sent">
              <span class={styles.doneIcon} aria-hidden="true">
                <CheckCircle />
              </span>
              <h1 id={titleId} class={styles.title}>
                Check your inbox
              </h1>
              <p class={styles.sub}>
                If an account exists for <strong>{sentTo()}</strong>, a reset
                link is on its way. The link expires in 2 hours.
              </p>
              <button
                type="button"
                class={styles.submit}
                onClick={() => props.onClose()}
              >
                Back to the app
              </button>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  )
}
