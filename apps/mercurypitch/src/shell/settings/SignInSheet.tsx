// ============================================================
// SignInSheet — the phone's one way in
// ============================================================
//
// One sheet, three ways in: Continue with Apple (iOS only, first, for App
// Store guideline 4.8), Continue with Google, and Email me a code. A password
// still works for accounts that have one, behind a quiet link. What the web
// dialog leads with stays off the phone: the password form as the first thing
// seen, the television's "Sign in with your phone" row (audit D2), the
// passkey button. The CAPTCHA is still there for the two ways the worker
// demands it (a code, a password), drawn only when Cloudflare needs a tap.
//
// The panes and what they do live in sign-in-flow.ts; this file draws them.
// Every in-app "Sign in" opens it (sign-in-state.ts), over whatever is on
// screen, and closing it leaves that screen exactly as it was.

import type { JSX } from 'solid-js'
import { createEffect, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import './settings.css'
import { AppleMark } from '@/components/account/AppleMark'
import { GoogleMark } from '@/components/account/GoogleMark'
import { Sheet } from '@/components/mobile/Sheet'
import Turnstile from '@/components/shared/Turnstile'
import type { AuthResponse } from '@/db/services/auth-service'
import { adoptDeviceVoiceprints } from '@/db/services/voiceprint-service'
import { appleSignInOffered, nativeGoogleSignInOffered, } from '@/features/account/sign-in-methods'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import { showNotification } from '@/stores/notifications-store'
import { BackIcon, CloseIcon, MailIcon, WarnIcon } from '../icons'
import { SIGN_IN_EVERYWHERE } from './account-copy'
import { markAccountFillDue } from './account-fill'
import { refreshAccount } from './account-state'
import { CodeBoxes } from './CodeBoxes'
import type { SignInFlow, SignInPane } from './sign-in-flow'
import { createSignInFlow } from './sign-in-flow'
import { closeSignIn, registerSignInPaneBack, signInOpen, } from './sign-in-state'

const TITLES: Record<SignInPane, string> = {
  methods: 'Sign in',
  email: 'Email me a code',
  code: 'Check your inbox',
  password: 'Sign in with a password',
  twofa: 'Enter your code',
}

/** The panes that talk to a worker route behind the CAPTCHA. */
const CAPTCHA_PANES: readonly SignInPane[] = ['email', 'code', 'password']

export interface SignInSheetProps {
  /** A session landed; after the sheet has closed and the account refreshed. */
  onSignedIn?: (auth: AuthResponse) => void
}

/** The failure under the pane, when there is one. */
function FailureLine(props: { flow: SignInFlow }): JSX.Element {
  return (
    <Show when={props.flow.failure()} keyed>
      {(failure) =>
        failure.kind === 'network' ? (
          <div
            class="mp-set-note mp-set-note--warn"
            role="status"
            data-testid="signin-offline"
          >
            <WarnIcon size={20} />
            <p>
              <strong>MercuryPitch could not reach your account.</strong> Check
              the connection and try again. You are still practicing on this
              phone.
            </p>
          </div>
        ) : (
          <p class="mp-signin__error" role="alert" data-testid="signin-error">
            {failure.text}
          </p>
        )
      }
    </Show>
  )
}

function MethodsPane(props: { flow: SignInFlow }): JSX.Element {
  const offered = (provider: 'apple' | 'google'): boolean =>
    !props.flow.unavailable().includes(provider) &&
    (provider === 'apple' ? appleSignInOffered() : nativeGoogleSignInOffered())
  return (
    <>
      <p class="mp-signin__lead">{SIGN_IN_EVERYWHERE}</p>
      <FailureLine flow={props.flow} />
      <div class="mp-signin__ways">
        <Show when={offered('apple')}>
          <button
            type="button"
            class="mp-provider mp-provider--apple"
            disabled={props.flow.busy()}
            onClick={() => void props.flow.continueWith('apple')}
            data-testid="signin-apple"
          >
            <AppleMark />
            Continue with Apple
          </button>
        </Show>
        <Show when={offered('google')}>
          <button
            type="button"
            class="mp-provider mp-provider--google"
            disabled={props.flow.busy()}
            onClick={() => void props.flow.continueWith('google')}
            data-testid="signin-google"
          >
            <GoogleMark />
            Continue with Google
          </button>
        </Show>
        <button
          type="button"
          class="mp-provider"
          disabled={props.flow.busy()}
          onClick={() => props.flow.go('email')}
          data-testid="signin-email"
        >
          <MailIcon size={18} />
          Email me a code
        </button>
      </div>
      <button
        type="button"
        class="mp-signin__link"
        onClick={() => props.flow.go('password')}
        data-testid="signin-use-password"
      >
        Use a password instead
      </button>
      <p class="mp-signin__fine">
        New here? Any of these sets up your account as you sign in. By
        continuing you accept the{' '}
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
          Terms
        </a>{' '}
        and the{' '}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          Privacy policy
        </a>
        .
      </p>
    </>
  )
}

function EmailPane(props: { flow: SignInFlow }): JSX.Element {
  return (
    <form
      class="mp-signin__form"
      onSubmit={(e) => {
        e.preventDefault()
        if (props.flow.canSendCode()) void props.flow.sendCode()
      }}
    >
      <label class="mp-field">
        <span class="mp-field__label">Email</span>
        <input
          class="mp-field__input"
          type="email"
          autocomplete="email"
          inputmode="email"
          value={props.flow.email()}
          onInput={(e) => props.flow.setEmail(e.currentTarget.value)}
          disabled={props.flow.busy()}
          data-testid="signin-email-input"
        />
      </label>
      <p class="mp-signin__caption">
        We send a six-digit code. New here? The code sets up your account; there
        is no password to make.
      </p>
      <FailureLine flow={props.flow} />
      <button
        type="submit"
        class="mp-set-button"
        disabled={!props.flow.canSendCode()}
        data-testid="signin-send-code"
      >
        {props.flow.busy() ? 'Sending…' : 'Send code'}
      </button>
    </form>
  )
}

function CodePane(props: { flow: SignInFlow }): JSX.Element {
  return (
    <>
      <p class="mp-signin__lead">
        A six-digit code is on its way to <strong>{props.flow.sentTo()}</strong>
        . It expires in 10 minutes.
      </p>
      <form
        class="mp-signin__form"
        onSubmit={(e) => {
          e.preventDefault()
          if (props.flow.canSubmitCode()) void props.flow.submitCode()
        }}
      >
        <CodeBoxes
          value={props.flow.mailedCode()}
          onInput={props.flow.setMailedCode}
          label="Code from the email"
          disabled={props.flow.busy()}
          testId="signin-code-input"
        />
        <FailureLine flow={props.flow} />
        <button
          type="submit"
          class="mp-set-button"
          disabled={!props.flow.canSubmitCode()}
          data-testid="signin-code-submit"
        >
          {props.flow.busy() ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      {/* What else to try waits for a second ask: the first code may just
          be slow, and one that never comes looks the same from here. Both
          lines are one status, so a screen reader reads the advice too. */}
      <Show when={props.flow.resent()}>
        <div class="mp-signin__notes" role="status">
          <p class="mp-signin__caption">Another code is on its way.</p>
          <p class="mp-signin__caption">
            Still nothing? Check the address and your spam folder, or try again
            in an hour.
          </p>
        </div>
      </Show>
      <button
        type="button"
        class="mp-signin__link"
        disabled={!props.flow.canResendCode()}
        onClick={() => void props.flow.resendCode()}
        data-testid="signin-resend"
      >
        Send another code
      </button>
    </>
  )
}

function PasswordPane(props: { flow: SignInFlow }): JSX.Element {
  return (
    <>
      <form
        class="mp-signin__form"
        onSubmit={(e) => {
          e.preventDefault()
          if (props.flow.canSubmitPassword()) void props.flow.submitPassword()
        }}
      >
        <label class="mp-field">
          <span class="mp-field__label">Email</span>
          <input
            class="mp-field__input"
            type="email"
            autocomplete="username"
            inputmode="email"
            value={props.flow.email()}
            onInput={(e) => props.flow.setEmail(e.currentTarget.value)}
            disabled={props.flow.busy()}
            data-testid="signin-password-email"
          />
        </label>
        <label class="mp-field">
          <span class="mp-field__label">Password</span>
          <input
            class="mp-field__input"
            type="password"
            autocomplete="current-password"
            value={props.flow.password()}
            onInput={(e) => props.flow.setPassword(e.currentTarget.value)}
            disabled={props.flow.busy()}
            data-testid="signin-password-input"
          />
        </label>
        <FailureLine flow={props.flow} />
        <button
          type="submit"
          class="mp-set-button"
          disabled={!props.flow.canSubmitPassword()}
          data-testid="signin-password-submit"
        >
          {props.flow.busy() ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <button
        type="button"
        class="mp-signin__link"
        onClick={() => props.flow.go('email')}
        data-testid="signin-forgot"
      >
        Forgot it? Email me a code instead
      </button>
    </>
  )
}

function SecondFactorPane(props: { flow: SignInFlow }): JSX.Element {
  return (
    <>
      <p class="mp-signin__lead">
        Open your authenticator app and enter the six-digit code. No app to
        hand? One of your recovery codes works here too.
      </p>
      <form
        class="mp-signin__form"
        onSubmit={(e) => {
          e.preventDefault()
          if (props.flow.canSubmitSecondFactor()) {
            void props.flow.submitSecondFactor()
          }
        }}
      >
        <CodeBoxes
          value={props.flow.secondFactor()}
          onInput={props.flow.setSecondFactor}
          label="Code from your authenticator app"
          acceptsRecoveryCode
          disabled={props.flow.busy()}
          testId="signin-twofa-input"
        />
        <FailureLine flow={props.flow} />
        <button
          type="submit"
          class="mp-set-button"
          disabled={!props.flow.canSubmitSecondFactor()}
          data-testid="signin-twofa-submit"
        >
          {props.flow.busy() ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </>
  )
}

export function SignInSheet(props: SignInSheetProps) {
  const flow = createSignInFlow({
    onSignedIn: (auth) => {
      closeSignIn()
      showNotification('Signed in', 'info')
      // An account made here takes this phone's unclaimed takes with it:
      // making it is the consent (REQ-NAM-036, 037). Signing in to one that
      // already existed takes nothing (REQ-NAM-039). Retag-first means a
      // failed upload is carried by the next sync, so nothing waits on it.
      if (auth.isNew) void adoptDeviceVoiceprints().catch(() => 0)
      // An account that already existed brings its history: the Account
      // screen says what arrived on the next visit (REQ-NAM-043).
      else markAccountFillDue(auth.userId)
      void refreshAccount()
      props.onSignedIn?.(auth)
    },
  })

  // Every open starts on the ways in; a close strands nothing in flight.
  createEffect(
    on(signInOpen, (open) => {
      if (open) flow.start()
      else flow.abandon()
    }),
  )

  onMount(() => {
    onCleanup(registerSignInPaneBack(() => flow.back()))
  })

  const captcha = (): boolean => CAPTCHA_PANES.includes(flow.pane())

  return (
    <Sheet isOpen={signInOpen()} close={closeSignIn} ariaLabel="Sign in">
      <div class="mp-signin" data-testid="signin-sheet" data-pane={flow.pane()}>
        <div class="mp-signin__head">
          <Show
            when={flow.pane() !== 'methods'}
            fallback={<span class="mp-signin__spacer" />}
          >
            <button
              type="button"
              class="mp-iconbtn"
              aria-label="Back"
              onClick={() => flow.back()}
              data-testid="signin-back"
            >
              <BackIcon />
            </button>
          </Show>
          <h2 class="mp-signin__title">{TITLES[flow.pane()]}</h2>
          <button
            type="button"
            class="mp-iconbtn"
            aria-label="Close"
            onClick={closeSignIn}
            data-testid="signin-close"
          >
            <CloseIcon />
          </button>
        </div>
        <Switch>
          <Match when={flow.pane() === 'methods'}>
            <MethodsPane flow={flow} />
          </Match>
          <Match when={flow.pane() === 'email'}>
            <EmailPane flow={flow} />
          </Match>
          <Match when={flow.pane() === 'code'}>
            <CodePane flow={flow} />
          </Match>
          <Match when={flow.pane() === 'password'}>
            <PasswordPane flow={flow} />
          </Match>
          <Match when={flow.pane() === 'twofa'}>
            <SecondFactorPane flow={flow} />
          </Match>
        </Switch>
        {/* One widget for the three panes behind the CAPTCHA, so stepping
            from the address to the code keeps it rather than starting a
            fresh challenge. */}
        <Show when={captcha()}>
          <Turnstile
            onToken={flow.setTurnstileToken}
            appearance="interaction-only"
          />
        </Show>
      </div>
    </Sheet>
  )
}
