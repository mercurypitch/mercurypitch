// ============================================================
// The sign-in flow — what each pane of the sheet does
// ============================================================
//
// Three ways in, all of them ceremonies that already exist: Apple (iOS only)
// and Google through the phone's own sheets (native-sign-in.ts), and a code
// by email (auth-email-code-service). A password still works for accounts
// that have one, behind a link. Any of them can come back owing a second
// factor, which is one more pane, word for word as the web's.
//
// The code asks for a SIGN-UP code (S6 decision 05 A): an address with no
// account gets one too, and typing it back creates the account, taking this
// phone's anonymous practice along (the device proof on verify). The pane
// never says whether the address had an account; neither does the Worker.
//
// What a failure looks like is decided here, because it is the part a singer
// is most likely to misread: a lost connection is named as one and says the
// practice on the phone is safe (REQ-NAM-016, 049); a dismissed Apple or
// Google sheet says nothing at all; a server that refused a provider's token
// is never worded as the singer's mistake.

import type { Accessor } from 'solid-js'
import { batch, createSignal } from 'solid-js'
import { resetTurnstile, turnstileEnabled, turnstileUnavailable, } from '@/components/shared/Turnstile'
import { requestLoginCode, verifyLoginCode, } from '@/db/services/auth-email-code-service'
import { verifyTwofa } from '@/db/services/auth-mfa-service'
import type { AuthResponse, SignInOutcome } from '@/db/services/auth-service'
import { isTwofaChallenge, loginWithPassword, takeNativeTwofaChallenge, } from '@/db/services/auth-service'
import { NativeSignInError, signInWithApple, signInWithGoogle, } from '@/features/account/native-sign-in'

export type SignInPane = 'methods' | 'email' | 'code' | 'password' | 'twofa'

export type SignInProvider = 'apple' | 'google'

/** Why the last attempt bought nothing, in the form the sheet shows it. */
export type SignInFailure =
  /** Nothing reached the account: the named no-connection note. */
  | { kind: 'network' }
  /** A sentence to show as it is. */
  | { kind: 'message'; text: string }

const PROVIDER_NAMES: Record<SignInProvider, string> = {
  apple: 'Apple',
  google: 'Google',
}

/** Six digits, the way the mailed code is written. */
export const CODE_LENGTH = 6

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SignInFlow {
  pane: Accessor<SignInPane>
  email: Accessor<string>
  setEmail: (value: string) => void
  password: Accessor<string>
  setPassword: (value: string) => void
  mailedCode: Accessor<string>
  setMailedCode: (value: string) => void
  secondFactor: Accessor<string>
  setSecondFactor: (value: string) => void
  /** The address the code went to, as it was when it was sent. */
  sentTo: Accessor<string>
  /** A second code went out from the code pane. */
  resent: Accessor<boolean>
  busy: Accessor<boolean>
  failure: Accessor<SignInFailure | null>
  /** Providers this phone turned out not to have, so their buttons go. */
  unavailable: Accessor<readonly SignInProvider[]>
  setTurnstileToken: (token: string) => void
  canSendCode: () => boolean
  canResendCode: () => boolean
  canSubmitCode: () => boolean
  canSubmitPassword: () => boolean
  canSubmitSecondFactor: () => boolean
  /** Every open starts here: the ways in, or a second factor still owed. */
  start: () => void
  /** The sheet closed: whatever is in flight no longer has a screen. */
  abandon: () => void
  go: (pane: SignInPane) => void
  /** One pane back. False when there is none to go back to. */
  back: () => boolean
  continueWith: (provider: SignInProvider) => Promise<void>
  sendCode: () => Promise<void>
  resendCode: () => Promise<void>
  submitCode: () => Promise<void>
  submitPassword: () => Promise<void>
  submitSecondFactor: () => Promise<void>
}

export interface SignInFlowOptions {
  /** A session landed. `isNew` on it says whether an account was created. */
  onSignedIn: (auth: AuthResponse) => void
}

/** What a thrown request error means to the singer. */
function failureOf(error: unknown): SignInFailure {
  // fetch() itself failing is the one shape of "nothing got there".
  if (error instanceof TypeError) return { kind: 'network' }
  if (error instanceof NativeSignInError && error.kind === 'network') {
    return { kind: 'network' }
  }
  const text = error instanceof Error ? error.message : String(error)
  return { kind: 'message', text }
}

export function createSignInFlow(options: SignInFlowOptions): SignInFlow {
  const [pane, setPane] = createSignal<SignInPane>('methods')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [mailedCode, setMailedCode] = createSignal('')
  const [secondFactor, setSecondFactor] = createSignal('')
  const [sentTo, setSentTo] = createSignal('')
  const [resent, setResent] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [failure, setFailure] = createSignal<SignInFailure | null>(null)
  const [unavailable, setUnavailable] = createSignal<readonly SignInProvider[]>(
    [],
  )
  const [turnstileToken, setTurnstileToken] = createSignal('')
  // Held here rather than in signals: nothing on screen shows them, and each
  // is only ever read by the next request.
  let codeCeremony = ''
  let factorCeremony = ''
  // Bumped by every new request and by a close, so a slow answer never lands
  // on a sheet that has moved on (or gone).
  let generation = 0

  /** The CAPTCHA's token, when the worker will want one and none is here yet. */
  const awaitingToken = (): boolean =>
    turnstileEnabled && !turnstileUnavailable() && turnstileToken() === ''

  /** Tokens are single-use: spent or refused, the widget has to issue another. */
  function spendToken(): void {
    setTurnstileToken('')
    resetTurnstile()
  }

  function go(next: SignInPane): void {
    batch(() => {
      setPane(next)
      setFailure(null)
    })
  }

  function land(outcome: SignInOutcome): void {
    if (isTwofaChallenge(outcome)) {
      factorCeremony = outcome.ceremony
      setSecondFactor('')
      go('twofa')
      return
    }
    options.onSignedIn(outcome)
  }

  /**
   * Run one request for the pane on screen, one at a time. A failure is
   * shown only while the sheet is still where the request left it.
   */
  async function attempt(work: () => Promise<void>): Promise<void> {
    if (busy()) return
    const request = ++generation
    setFailure(null)
    setBusy(true)
    try {
      await work()
    } catch (error) {
      if (request === generation) setFailure(failureOf(error))
    } finally {
      if (request === generation) setBusy(false)
    }
  }

  async function continueWith(provider: SignInProvider): Promise<void> {
    await attempt(async () => {
      const request = generation
      try {
        const outcome =
          provider === 'apple'
            ? await signInWithApple()
            : await signInWithGoogle()
        if (request === generation) land(outcome)
      } catch (error) {
        if (!(error instanceof NativeSignInError)) throw error
        if (request !== generation) return
        // Dismissing the system sheet is an answer, not an error.
        if (error.kind === 'cancelled') return
        if (error.kind === 'unavailable') {
          setUnavailable((list) =>
            list.includes(provider) ? list : [...list, provider],
          )
          setFailure({
            kind: 'message',
            text: `${PROVIDER_NAMES[provider]} sign-in is not available on this phone. Choose another way.`,
          })
          return
        }
        if (error.kind === 'invalid_token') {
          // The ceremony worked and the server refused it: configuration,
          // not anything the singer did.
          setFailure({
            kind: 'message',
            text: `MercuryPitch could not finish signing in with ${PROVIDER_NAMES[provider]}. Try again, or choose another way.`,
          })
          return
        }
        throw error
      }
    })
  }

  async function requestCode(address: string, token: string): Promise<string> {
    try {
      return await requestLoginCode(address, token, { signUp: true })
    } finally {
      spendToken()
    }
  }

  // Each request reads what is on screen before it starts, so the work
  // itself holds plain values and a keystroke mid-request changes nothing.

  async function sendCode(): Promise<void> {
    const address = email().trim().toLowerCase()
    const token = turnstileToken()
    await attempt(async () => {
      const request = generation
      const ceremony = await requestCode(address, token)
      if (request !== generation) return
      codeCeremony = ceremony
      batch(() => {
        setSentTo(address)
        setMailedCode('')
        setResent(false)
        go('code')
      })
    })
  }

  async function resendCode(): Promise<void> {
    const address = sentTo()
    const token = turnstileToken()
    await attempt(async () => {
      const request = generation
      const ceremony = await requestCode(address, token)
      if (request !== generation) return
      codeCeremony = ceremony
      batch(() => {
        setMailedCode('')
        setResent(true)
      })
    })
  }

  async function submitCode(): Promise<void> {
    const ceremony = codeCeremony
    const code = mailedCode()
    await attempt(async () => {
      const request = generation
      // A wrong code is said so and the digits stay, for a retype.
      const outcome = await verifyLoginCode(ceremony, code, {
        proveDevice: true,
      })
      if (request === generation) land(outcome)
    })
  }

  async function submitPassword(): Promise<void> {
    const address = email().trim()
    const typed = password()
    const token = turnstileToken()
    await attempt(async () => {
      const request = generation
      try {
        const outcome = await loginWithPassword(address, typed, token)
        if (request !== generation) return
        // Right or owing a second factor, the password has done its job.
        setPassword('')
        land(outcome)
      } finally {
        spendToken()
      }
    })
  }

  async function submitSecondFactor(): Promise<void> {
    const ceremony = factorCeremony
    const code = secondFactor()
    await attempt(async () => {
      const request = generation
      const auth = await verifyTwofa(ceremony, code)
      if (request === generation) options.onSignedIn(auth)
    })
  }

  function start(): void {
    generation += 1
    codeCeremony = ''
    factorCeremony = ''
    batch(() => {
      setBusy(false)
      setPassword('')
      setMailedCode('')
      setSecondFactor('')
      setResent(false)
      setFailure(null)
      setTurnstileToken('')
      setPane('methods')
    })
    // A second factor still owed from a surface with no code field of its
    // own (the returning sign-in strip) is finished here.
    const owed = takeNativeTwofaChallenge()
    if (owed !== null) {
      factorCeremony = owed
      setPane('twofa')
    }
  }

  function abandon(): void {
    generation += 1
    setBusy(false)
  }

  function back(): boolean {
    const current = pane()
    if (current === 'methods') return false
    generation += 1
    setBusy(false)
    if (current === 'code') {
      go('email')
      return true
    }
    if (current === 'twofa') factorCeremony = ''
    go('methods')
    return true
  }

  return {
    pane,
    email,
    setEmail,
    password,
    setPassword,
    mailedCode,
    setMailedCode,
    secondFactor,
    setSecondFactor,
    sentTo,
    resent,
    busy,
    failure,
    unavailable,
    setTurnstileToken,
    canSendCode: () =>
      !busy() && EMAIL_SHAPE.test(email().trim()) && !awaitingToken(),
    canResendCode: () => !busy() && !awaitingToken(),
    canSubmitCode: () => !busy() && mailedCode().length === CODE_LENGTH,
    canSubmitPassword: () =>
      !busy() &&
      EMAIL_SHAPE.test(email().trim()) &&
      password() !== '' &&
      !awaitingToken(),
    canSubmitSecondFactor: () =>
      !busy() && secondFactor().trim().length >= CODE_LENGTH,
    start,
    abandon,
    go,
    back,
    continueWith,
    sendCode,
    resendCode,
    submitCode,
    submitPassword,
    submitSecondFactor,
  }
}
