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
import { CheckCircle, Eye, EyeOff, Smartphone, X } from '@/components/icons'
import Turnstile, { resetTurnstile, turnstileEnabled, turnstileUnavailable, } from '@/components/shared/Turnstile'
import { requestLoginCode, verifyLoginCode, } from '@/db/services/auth-email-code-service'
import { verifyTwofa } from '@/db/services/auth-mfa-service'
import { isTwofaChallenge, loginWithPassword, registerWithPassword, requestPasswordReset, takeGoogleTwofaChallenge, } from '@/db/services/auth-service'
import { adoptDeviceVoiceprints } from '@/db/services/voiceprint-service'
import { isTvDevice } from '@/lib/device-tier'
import { googleSignInPending, googleSignInUnavailableReason, startGoogleSignIn, } from '@/lib/google-sign-in'
import { isPasswordValid } from '@/lib/password-policy'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { showNotification } from '@/stores/notifications-store'
import { armOnboardingResume } from '@/stores/onboarding-store'
import { authModalMode, closeAuthModal } from '@/stores/ui-store'
import styles from './AuthModal.module.css'
import { GoogleMark } from './GoogleMark'
import { PasswordRequirements } from './PasswordRequirements'
import { PhoneSignIn } from './PhoneSignIn'

type Pane =
  | 'login'
  | 'register'
  | 'forgot'
  | 'forgot-sent'
  | 'phone'
  | 'twofa'
  | 'email-code'
  | 'email-code-sent'

const TITLES: Record<Pane, string> = {
  login: 'Sign in',
  register: 'Create your account',
  forgot: 'Reset your password',
  'forgot-sent': 'Check your inbox',
  phone: 'Sign in with your phone',
  twofa: 'Enter your code',
  'email-code': 'Sign in with a code',
  'email-code-sent': 'Check your inbox',
}

export interface AuthModalProps {
  /** The host surface may tint the shared dialog without owning auth logic. */
  tone?: 'default' | 'guitar-night' | 'drum-night'
  /** Reconcile account-aware standalone UI before this dialog closes. */
  onAuthenticated?: () => void
  /** Prepare a host-owned return intent, with rollback if Google cannot start. */
  prepareGoogleRedirect?: () => (() => void) | undefined
}

export const AuthModal: Component<AuthModalProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  let titleRef: HTMLHeadingElement | undefined
  let passwordRef: HTMLInputElement | undefined
  let requestGeneration = 0
  const titleId = createUniqueId()

  // A television opens straight on the phone pane. Not a preference: the
  // alternative is entering an email address with a d-pad, which is the
  // reason this pane exists at all.
  const [pane, setPane] = createSignal<Pane>(isTvDevice() ? 'phone' : 'login')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [showPassword, setShowPassword] = createSignal(false)
  const [displayName, setDisplayName] = createSignal('')
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [turnstileToken, setTurnstileToken] = createSignal('')
  // The address the forgot-sent confirmation names (snapshotted on send,
  // so later edits to the field can't rewrite the message).
  const [sentTo, setSentTo] = createSignal('')
  // The ceremony token a sign-in came back needing a code for. Holding it
  // proves the first factor was accepted and nothing else — it buys no
  // session on its own, which is exactly why the password can be forgotten
  // the moment it is issued.
  const [ceremony, setCeremony] = createSignal('')
  const [twofaCode, setTwofaCode] = createSignal('')
  // The mailed code's own ceremony, kept apart from the 2FA one: a code
  // sign-in can END in a 2FA challenge, and the two tokens are live at the
  // same moment for different purposes.
  const [codeCeremony, setCodeCeremony] = createSignal('')
  const [mailedCode, setMailedCode] = createSignal('')

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
    // A reopened dialog must not inherit the completion of a request the
    // player dismissed on the previous open.
    requestGeneration += 1
    // On a TV, "sign in" means the phone pane whichever entry point asked;
    // "create account" still needs the form, since there is nothing to
    // approve from yet.
    setPane(isTvDevice() && mode === 'login' ? 'phone' : mode)
    setPassword('')
    setShowPassword(false)
    setError('')
    setBusy(false)
    setTurnstileToken('')
    resetTurnstile()
    // The baseline `dirty` compares against — see close()/onBackdropClick.
    setEmailAtOpen(untrack(email))
    // A Google redirect can come back owing a second factor. It carries the
    // ceremony in the URL fragment, which auth-service stashes at startup;
    // picking it up here is what turns that into a visible code prompt
    // instead of a sign-in that silently did nothing.
    const googleCeremony = takeGoogleTwofaChallenge()
    if (googleCeremony !== null) {
      setCeremony(googleCeremony)
      setPane('twofa')
    }
  })

  function close(): void {
    // Authentication may outlive the dialog. Closing invalidates its UI
    // continuation (including Guitar Night's billable separation retry),
    // while the request itself remains free to settle in the auth service.
    requestGeneration += 1
    closeAuthModal()
    setBusy(false)
    setPassword('')
    setShowPassword(false)
    setError('')
    setTurnstileToken('')
    resetTurnstile()
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
    if (next !== 'twofa') {
      setCeremony('')
      setTwofaCode('')
    }
    if (next !== 'email-code-sent' && next !== 'twofa') {
      // Leaving the flow entirely drops the mailed code. Stepping from the
      // code pane INTO the 2FA pane does not: that ceremony is spent and the
      // sign-in is still in progress.
      setCodeCeremony('')
      setMailedCode('')
    }
    // The control that changes panes unmounts. Without an explicit handoff,
    // focus falls to <body> and the next Tab enters at the end of the dialog,
    // skipping every field in the newly displayed form.
    queueMicrotask(() => {
      const firstInput = dialogRef?.querySelector<HTMLInputElement>('input')
      ;(firstInput ?? titleRef)?.focus({ preventScroll: true })
    })
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => authModalMode() != null,
    onClose: close,
    // Land on the first field, not the header's close button.
    initialFocus: () => dialogRef?.querySelector('input') ?? titleRef,
  })

  /** Shows the failure inline, next to the form the singer is already
   *  looking at. Starting the redirect is shared — see lib/google-sign-in. */
  async function onGoogleSignIn(): Promise<void> {
    // The redirect is a full page load; if this modal was opened from the
    // onboarding flow, remember where it stood (a no-op on every other
    // surface, where the auth return-hash restores the route instead).
    armOnboardingResume()
    const failure = await startGoogleSignIn({
      prepareRedirect: props.prepareGoogleRedirect,
    })
    if (failure !== null) setError(failure)
  }

  /**
   * Panes that ask for an address and nothing else.
   *
   * Both hide the password field, the provider buttons and the divider — a
   * "Continue with Google" button on a form whose whole point is not needing a
   * password is an invitation to abandon the flow halfway.
   */
  const emailOnlyPane = (): boolean =>
    pane() === 'forgot' || pane() === 'email-code'

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
    const request = ++requestGeneration

    const run = async (): Promise<void> => {
      setError('')
      setBusy(true)
      const token = turnstileToken()
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
            token,
          )
          if (request !== requestGeneration) return
          // Creating the account IS the consent the voiceprint adoption
          // notice would ask for — the onboarding keep beat promised "keep
          // this take", so takes made signed-out on this device join the
          // brand-new account right away. Signing in to an EXISTING
          // account stays prompt-gated (spec REQ-VPR-014).
          void adoptDeviceVoiceprints()
          showNotification('Account created — progress is now synced', 'info')
          props.onAuthenticated?.()
          close()
        } else if (current === 'login') {
          const outcome = await loginWithPassword(
            credentials.email,
            credentials.password,
            token,
          )
          if (request !== requestGeneration) return
          if (isTwofaChallenge(outcome)) {
            // The password was right and bought nothing. Drop it from the
            // form before showing the next pane: it is no longer needed, and
            // leaving it in a live input is a needless place for it to sit.
            setPassword('')
            setCeremony(outcome.ceremony)
            switchPane('twofa')
            return
          }
          showNotification('Signed in', 'info')
          props.onAuthenticated?.()
          close()
        } else if (current === 'twofa') {
          await verifyTwofa(ceremony(), twofaCode())
          if (request !== requestGeneration) return
          showNotification('Signed in', 'info')
          props.onAuthenticated?.()
          close()
        } else if (current === 'email-code') {
          const issued = await requestLoginCode(credentials.email, token)
          if (request !== requestGeneration) return
          setCodeCeremony(issued)
          setSentTo(credentials.email)
          switchPane('email-code-sent')
        } else if (current === 'email-code-sent') {
          const outcome = await verifyLoginCode(codeCeremony(), mailedCode())
          if (request !== requestGeneration) return
          if (isTwofaChallenge(outcome)) {
            // The inbox was proved and bought nothing: this account owes a
            // second factor as well.
            setCeremony(outcome.ceremony)
            switchPane('twofa')
            return
          }
          showNotification('Signed in', 'info')
          props.onAuthenticated?.()
          close()
        } else if (current === 'forgot') {
          await requestPasswordReset(credentials.email, token)
          if (request !== requestGeneration) return
          setSentTo(credentials.email)
          switchPane('forgot-sent')
        }
      } catch (err) {
        if (request !== requestGeneration) return
        setError(err instanceof Error ? err.message : String(err))
        setTurnstileToken('')
        resetTurnstile()
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
        if (request === requestGeneration) setBusy(false)
      }
    }
    void run()
  }

  return (
    <Show when={authModalMode() != null}>
      <div
        class={styles.overlay}
        data-tone={props.tone ?? 'default'}
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
            <h2 ref={titleRef} id={titleId} class={styles.title} tabindex="-1">
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
            {/* Sign in from the phone — the TV's default way in */}
            <Match when={pane() === 'phone'}>
              <PhoneSignIn
                onLinked={() => {
                  // Signing in to an EXISTING account, so voiceprint
                  // adoption stays prompt-gated (see the register path).
                  showNotification('Signed in', 'info')
                  props.onAuthenticated?.()
                  close()
                }}
              />
              <p class={styles.switchRow}>
                <button
                  type="button"
                  class={styles.linkButton}
                  onClick={() => switchPane('login')}
                  data-testid="auth-switch-email"
                >
                  Use email and password instead
                </button>
              </p>
            </Match>

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

            {/* The six digits from the email. Answers the same for an
                address with an account and one without — the pane cannot say
                which, because the endpoint behind it deliberately does not. */}
            <Match when={pane() === 'email-code-sent'}>
              <p class={styles.sub}>
                If an account exists for <strong>{sentTo()}</strong>, a
                six-digit code is on its way. It expires in 10 minutes.
              </p>
              <form
                class={styles.form}
                onSubmit={handleSubmit}
                data-testid="auth-email-code-form"
              >
                <Show when={error() !== ''}>
                  <p
                    class={styles.errorNote}
                    data-testid="auth-error"
                    role="alert"
                  >
                    {error()}
                  </p>
                </Show>
                <label class={styles.field}>
                  <span class={styles.fieldLabel}>Code</span>
                  <input
                    class={styles.input}
                    type="text"
                    value={mailedCode()}
                    onInput={(e) => setMailedCode(e.currentTarget.value)}
                    autocomplete="one-time-code"
                    inputmode="numeric"
                    autofocus
                    required
                    disabled={busy()}
                    data-testid="auth-email-code-input"
                    placeholder="123456"
                  />
                </label>
                <button
                  type="submit"
                  class={styles.submit}
                  disabled={busy() || mailedCode().trim() === ''}
                  data-testid="auth-email-code-submit"
                >
                  {busy() ? 'Checking\u2026' : 'Sign in'}
                </button>
              </form>
              <p class={styles.switchRow}>
                <button
                  type="button"
                  class={styles.linkButton}
                  onClick={() => switchPane('login')}
                  data-testid="auth-email-code-back"
                >
                  Back to sign in
                </button>
              </p>
            </Match>

            {/* Second factor. Reached from a password sign-in, from a
                mailed code, and from the Google redirect — the pane does not
                care which, because the ceremony token carries that. */}
            <Match when={pane() === 'twofa'}>
              <p class={styles.sub}>
                Open your authenticator app and enter the six-digit code. No app
                to hand? One of your recovery codes works here too.
              </p>
              <form
                class={styles.form}
                onSubmit={handleSubmit}
                data-testid="auth-twofa-form"
              >
                <Show when={error() !== ''}>
                  <p
                    class={styles.errorNote}
                    data-testid="auth-error"
                    role="alert"
                  >
                    {error()}
                  </p>
                </Show>
                <label class={styles.field}>
                  <span class={styles.fieldLabel}>Code</span>
                  <input
                    class={styles.input}
                    type="text"
                    value={twofaCode()}
                    onInput={(e) => setTwofaCode(e.currentTarget.value)}
                    // One-time-code autofill so iOS and Android offer the
                    // code from the notification rather than making somebody
                    // switch apps and retype it.
                    autocomplete="one-time-code"
                    inputmode="text"
                    autofocus
                    required
                    disabled={busy()}
                    data-testid="auth-twofa-code"
                    placeholder="123456"
                  />
                </label>
                <button
                  type="submit"
                  class={styles.submit}
                  disabled={busy() || twofaCode().trim() === ''}
                  data-testid="auth-twofa-submit"
                >
                  {busy() ? 'Checking…' : 'Sign in'}
                </button>
              </form>
              <p class={styles.switchRow}>
                <button
                  type="button"
                  class={styles.linkButton}
                  onClick={() => switchPane('login')}
                  data-testid="auth-twofa-back"
                >
                  Start over
                </button>
              </p>
            </Match>

            {/* Login / register / forgot form */}
            <Match when={true}>
              <p class={styles.sub}>
                {pane() === 'forgot'
                  ? "Enter your account email and we'll send you a link to choose a new password."
                  : pane() === 'email-code'
                    ? "Enter your account email and we'll send you a six-digit code. No password needed."
                    : 'Your progress, scores and credits follow your account across devices.'}
              </p>

              <Show when={!emailOnlyPane()}>
                <Show
                  when={googleSignInUnavailableReason === null}
                  fallback={
                    <p
                      class={styles.providerNote}
                      data-testid="auth-google-unavailable"
                    >
                      {googleSignInUnavailableReason}
                    </p>
                  }
                >
                  <button
                    type="button"
                    class={styles.googleButton}
                    onClick={() => void onGoogleSignIn()}
                    data-testid="auth-google"
                    disabled={googleSignInPending()}
                  >
                    <GoogleMark />
                    {googleSignInPending()
                      ? 'Opening Google\u2026'
                      : 'Continue with Google'}
                  </button>
                </Show>
                <Show when={pane() === 'login'}>
                  <button
                    type="button"
                    class={styles.googleButton}
                    onClick={() => switchPane('phone')}
                    data-testid="auth-phone"
                  >
                    <Smartphone />
                    Sign in with your phone
                  </button>
                </Show>
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

                <Show when={!emailOnlyPane()}>
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
                      onClick={() => switchPane('email-code')}
                      data-testid="auth-email-code-link"
                    >
                      Email me a code
                    </button>
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

                <Turnstile onToken={setTurnstileToken} />

                <button
                  class={styles.submit}
                  type="submit"
                  disabled={
                    busy() ||
                    (turnstileEnabled &&
                      turnstileToken() === '' &&
                      !turnstileUnavailable())
                  }
                  data-testid="auth-submit"
                >
                  {busy()
                    ? pane() === 'register'
                      ? 'Creating account…'
                      : emailOnlyPane()
                        ? 'Sending…'
                        : 'Signing in…'
                    : pane() === 'register'
                      ? 'Create account'
                      : pane() === 'forgot'
                        ? 'Send reset link'
                        : pane() === 'email-code'
                          ? 'Email me a code'
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
                  <Match when={pane() === 'email-code'}>
                    Rather use your password?{' '}
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
