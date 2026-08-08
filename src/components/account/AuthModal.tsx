// ============================================================
// AuthModal — shared sign-in / create-account / forgot-password dialog
// ============================================================
//
// One focus-trapped modal for every "sign in" entry point (the header
// pill, Settings → Account). Panes: login, register, and a forgot-
// password pane that emails a single-use reset link (the link lands on
// ResetPasswordPage). Opened via openAuthModal() in ui-store; a
// successful sign-in closes the dialog and account-aware UI refreshes
// itself through the authVersion/authStamp signals.

import type { Component } from 'solid-js'
import { createEffect, createSignal, createUniqueId, Match, Show, Switch, untrack, } from 'solid-js'
import { CheckCircle, Eye, EyeOff, X } from '@/components/icons'
import { googleSignInUrl, loginWithPassword, registerWithPassword, requestPasswordReset, } from '@/db/services/auth-service'
import { adoptDeviceVoiceprints } from '@/db/services/voiceprint-service'
import { isPasswordValid } from '@/lib/password-policy'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { showNotification } from '@/stores/notifications-store'
import { authModalMode, closeAuthModal } from '@/stores/ui-store'
import styles from './AuthModal.module.css'
import { GoogleMark } from './GoogleMark'
import { PasswordRequirements } from './PasswordRequirements'

type Pane = 'login' | 'register' | 'forgot' | 'forgot-sent'

const TITLES: Record<Pane, string> = {
  login: 'Sign in',
  register: 'Create your account',
  forgot: 'Reset your password',
  'forgot-sent': 'Check your inbox',
}

export const AuthModal: Component = () => {
  let dialogRef: HTMLDivElement | undefined
  let passwordRef: HTMLInputElement | undefined
  const titleId = createUniqueId()

  const [pane, setPane] = createSignal<Pane>('login')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [showPassword, setShowPassword] = createSignal(false)
  const [displayName, setDisplayName] = createSignal('')
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  // The address the forgot-sent confirmation names (snapshotted on send,
  // so later edits to the field can't rewrite the message).
  const [sentTo, setSentTo] = createSignal('')

  /**
   * Has anything been typed into this form?
   *
   * `email` deliberately survives a close (see the effect above), so an
   * address carried over from a previous open is not "typed" for this
   * purpose — only a password or a display name, plus an email that
   * differs from whatever was already there when the modal opened.
   */
  const [emailAtOpen, setEmailAtOpen] = createSignal('')
  const dirty = (): boolean =>
    password() !== '' || displayName() !== '' || email() !== emailAtOpen()

  // Every open lands on the requested pane with transient state cleared.
  // The email survives on purpose: retrying login → forgot → back keeps it.
  createEffect(() => {
    const mode = authModalMode()
    if (mode == null) return
    setPane(mode)
    setPassword('')
    setShowPassword(false)
    setError('')
    setBusy(false)
    // The baseline `dirty` compares against — see close()/onBackdropClick.
    setEmailAtOpen(untrack(email))
  })

  function close(): void {
    if (busy()) return
    closeAuthModal()
    setPassword('')
    setShowPassword(false)
    setError('')
  }

  /**
   * Backdrop click. An untouched form still closes on one — opening this
   * by accident should cost one click to undo. Once anything has been
   * typed it stops closing, because a stray click outside a half-filled
   * sign-up discards the lot with no warning and no undo, which is what
   * owner testing hit. The X and Escape stay unconditional, so there is
   * never a state with no way out.
   */
  function onBackdropClick(): void {
    if (dirty()) return
    close()
  }

  function switchPane(next: Pane): void {
    setPane(next)
    setError('')
    setShowPassword(false)
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => authModalMode() != null,
    onClose: close,
    // Land on the first field, not the header's close button.
    initialFocus: () => dialogRef?.querySelector('input') ?? undefined,
  })

  /** Full-page redirect via the worker: COOP severs window.opener, so
   *  the GIS popup flow cannot work here (see auth-service). */
  function startGoogleSignIn(): void {
    window.location.assign(googleSignInUrl())
  }

  // Live password validity (register only) — red border + checklist so
  // nobody discovers the rules one server rejection at a time.
  const pwdInvalid = (): boolean =>
    pane() === 'register' && password() !== '' && !isPasswordValid(password())

  function handleSubmit(e: Event): void {
    e.preventDefault()
    if (busy()) return
    // Snapshot the form inside the event handler — the async closures
    // below run outside the tracked scope (and the form could change
    // mid-request).
    const current = pane()
    const credentials = { email: email().trim(), password: password() }
    const name = displayName().trim()

    const run = async (): Promise<void> => {
      setError('')
      setBusy(true)
      try {
        if (current === 'register') {
          if (!isPasswordValid(credentials.password)) {
            setError("Password doesn't meet the requirements yet.")
            return
          }
          await registerWithPassword(
            credentials.email,
            credentials.password,
            name,
          )
          // Creating the account IS the consent the voiceprint adoption
          // notice would ask for — the onboarding keep beat promised "keep
          // this take", so takes made signed-out on this device join the
          // brand-new account right away. Signing in to an EXISTING
          // account stays prompt-gated (spec REQ-VPR-014).
          void adoptDeviceVoiceprints()
          showNotification('Account created — progress is now synced', 'info')
          setBusy(false) // before close() — its busy-guard is for user dismissal
          close()
        } else if (current === 'login') {
          await loginWithPassword(credentials.email, credentials.password)
          showNotification('Signed in', 'info')
          setBusy(false)
          close()
        } else if (current === 'forgot') {
          await requestPasswordReset(credentials.email)
          setSentTo(credentials.email)
          setPane('forgot-sent')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        // A rejected sign-in clears the password and re-arms the field for
        // the password manager: extensions refuse to overwrite a non-empty
        // password input (and skip one revealed as type="text"), so leaving
        // the wrong attempt in place is what made autofill look broken on
        // retry. Guarded so a retype already in progress is not wiped, and
        // login-only — a register fix-up wants the typed attempt kept.
        if (current === 'login' && password() === credentials.password) {
          setPassword('')
          setShowPassword(false)
          passwordRef?.focus({ preventScroll: true })
        }
      } finally {
        setBusy(false)
      }
    }
    void run()
  }

  return (
    <Show when={authModalMode() != null}>
      <div
        class={styles.overlay}
        data-testid="auth-modal-overlay"
        onClick={onBackdropClick}
      >
        <div
          ref={dialogRef}
          class={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={busy() ? true : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div class={styles.head}>
            <h2 id={titleId} class={styles.title}>
              {TITLES[pane()]}
            </h2>
            <button
              type="button"
              class={styles.close}
              onClick={close}
              aria-label="Close"
              data-testid="auth-modal-close"
            >
              <X />
            </button>
          </div>

          <Switch>
            {/* Reset link sent — neutral confirmation, no account leak */}
            <Match when={pane() === 'forgot-sent'}>
              <div class={styles.sentState} data-testid="auth-forgot-sent">
                <span class={styles.sentIcon} aria-hidden="true">
                  <CheckCircle />
                </span>
                <p class={styles.sub}>
                  If an account exists for <strong>{sentTo()}</strong>, a reset
                  link is on its way. The link expires in 2 hours.
                </p>
                <button
                  type="button"
                  class={styles.submit}
                  onClick={() => switchPane('login')}
                >
                  Back to sign in
                </button>
              </div>
            </Match>

            {/* Login / register / forgot form */}
            <Match when={true}>
              <p class={styles.sub}>
                {pane() === 'forgot'
                  ? "Enter your account email and we'll send you a link to choose a new password."
                  : 'Your progress, scores and credits follow your account across devices.'}
              </p>

              <Show when={pane() !== 'forgot'}>
                <button
                  type="button"
                  class={styles.googleButton}
                  onClick={startGoogleSignIn}
                  data-testid="auth-google"
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <div class={styles.divider} role="presentation">
                  <span>or use email</span>
                </div>
              </Show>

              <form class={styles.form} onSubmit={handleSubmit}>
                <Show when={pane() === 'register'}>
                  <label class={styles.field}>
                    <span class={styles.fieldLabel}>
                      Display name{' '}
                      <span class={styles.fieldOptional}>(optional)</span>
                    </span>
                    <input
                      class={styles.input}
                      type="text"
                      placeholder="How you appear on leaderboards"
                      autocomplete="nickname"
                      maxLength={40}
                      value={displayName()}
                      onInput={(e) => setDisplayName(e.currentTarget.value)}
                      data-testid="auth-display-name"
                    />
                  </label>
                </Show>

                <label class={styles.field}>
                  <span class={styles.fieldLabel}>Email</span>
                  <input
                    class={styles.input}
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    autocomplete="username"
                    required
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    aria-invalid={error() !== '' ? 'true' : undefined}
                    aria-describedby={error() !== '' ? 'auth-error' : undefined}
                    data-testid="auth-email"
                  />
                </label>

                <Show when={pane() !== 'forgot'}>
                  <label class={styles.field}>
                    <span class={styles.fieldLabel}>Password</span>
                    <div class={styles.passwordField}>
                      <input
                        ref={passwordRef}
                        class={styles.input}
                        type={showPassword() ? 'text' : 'password'}
                        name="password"
                        placeholder={
                          pane() === 'register'
                            ? '8+ characters, a letter and a number'
                            : 'Your password'
                        }
                        autocomplete={
                          pane() === 'register'
                            ? 'new-password'
                            : 'current-password'
                        }
                        required
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                        aria-invalid={
                          pwdInvalid() || error() !== '' ? 'true' : undefined
                        }
                        aria-describedby={
                          error() !== '' ? 'auth-error' : undefined
                        }
                        data-testid="auth-password"
                      />
                      <button
                        class={styles.revealButton}
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword() ? 'Hide password' : 'Show password'
                        }
                        aria-pressed={showPassword()}
                        title={
                          showPassword() ? 'Hide password' : 'Show password'
                        }
                        data-testid="auth-password-toggle"
                      >
                        <Show when={showPassword()} fallback={<Eye />}>
                          <EyeOff />
                        </Show>
                      </button>
                    </div>
                  </label>
                </Show>

                <Show when={pane() === 'login'}>
                  <div class={styles.forgotRow}>
                    <button
                      type="button"
                      class={styles.linkButton}
                      onClick={() => switchPane('forgot')}
                      data-testid="auth-forgot-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                </Show>

                <Show when={pane() === 'register'}>
                  <PasswordRequirements
                    password={password()}
                    showInvalid={password() !== ''}
                  />
                </Show>

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

                <button
                  class={styles.submit}
                  type="submit"
                  disabled={busy()}
                  data-testid="auth-submit"
                >
                  {busy()
                    ? pane() === 'register'
                      ? 'Creating account…'
                      : pane() === 'forgot'
                        ? 'Sending…'
                        : 'Signing in…'
                    : pane() === 'register'
                      ? 'Create account'
                      : pane() === 'forgot'
                        ? 'Send reset link'
                        : 'Sign in'}
                </button>
              </form>

              <p class={styles.switchRow}>
                <Switch>
                  <Match when={pane() === 'login'}>
                    New to MercuryPitch?{' '}
                    <button
                      type="button"
                      class={styles.linkButton}
                      onClick={() => switchPane('register')}
                      data-testid="auth-switch-register"
                    >
                      Create an account
                    </button>
                  </Match>
                  <Match when={pane() === 'register'}>
                    Already have an account?{' '}
                    <button
                      type="button"
                      class={styles.linkButton}
                      onClick={() => switchPane('login')}
                      data-testid="auth-switch-login"
                    >
                      Sign in
                    </button>
                  </Match>
                  <Match when={pane() === 'forgot'}>
                    Remembered it?{' '}
                    <button
                      type="button"
                      class={styles.linkButton}
                      onClick={() => switchPane('login')}
                      data-testid="auth-switch-login"
                    >
                      Back to sign in
                    </button>
                  </Match>
                </Switch>
              </p>
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  )
}
