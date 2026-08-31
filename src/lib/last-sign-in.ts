// ── How this device usually gets in ──────────────────────────────────
//
// There is no way to ask a browser "does this person have a passkey here".
// No API exposes it, deliberately: it would be a fingerprinting vector, and
// `getClientCapabilities()` reports only what the BROWSER supports, never what
// credentials exist. The two honest mechanisms are conditional UI, where the
// browser checks its own store and offers what it finds in autofill, and this
// — remembering, on this device, how the last sign-in happened.
//
// Deliberately the METHOD and nothing else. No name, no address, no user id: a
// rehearsal-room laptop or a shared family browser must not tell the next
// person who practises here. "Sign in with your passkey" is the whole payload,
// and a passkey needs no address anyway — the credential is discoverable.
//
// Survives signing out on purpose. Signing out and coming back is exactly the
// case this exists for; the value is a UI hint, never a credential, and it
// grants nothing on its own.

import { createPersistedSignal } from './storage'

export type SignInMethod = 'passkey' | 'google' | 'password' | 'emailcode'

const KEY = 'pitchperfect_last_sign_in'

const METHODS: SignInMethod[] = ['passkey', 'google', 'password', 'emailcode']

function isMethod(value: unknown): value is SignInMethod | '' {
  return value === '' || METHODS.includes(value as SignInMethod)
}

const [stored, setStored] = createPersistedSignal<SignInMethod | ''>(KEY, '', {
  validator: isMethod,
})

/** The method this device last got in with, or '' if it never has. */
export function lastSignInMethod(): SignInMethod | '' {
  return stored()
}

/**
 * Remember how someone got in.
 *
 * Called when the FIRST factor succeeds, not when the session lands — an
 * account that then owes a 2FA code still gets in the same way next time, and
 * the hint is about what to offer, not about what completed. A hint left by an
 * abandoned 2FA prompt costs nothing: the password really is right.
 */
export function rememberSignInMethod(method: SignInMethod): void {
  setStored(method)
}

// ── The returning-visitor prompt's own dismissal ─────────────────────
//
// Lives here rather than in the component because it is the same concern —
// what this device remembers about signing in — and because that makes account
// deletion a single call that clears all of it.

const DISMISS_KEY = 'pitchperfect_returning_signin_dismissed'

const [dismissed, setDismissed] = createPersistedSignal<string>(DISMISS_KEY, '')

/** True once the visitor has waved the Home prompt away. Permanent. */
export function returningPromptDismissed(): boolean {
  return dismissed() === '1'
}

/** Wave it away for good. A prompt that has to be dismissed twice is a nag. */
export function dismissReturningPrompt(): void {
  setDismissed('1')
}

/**
 * Forget all of it — the method and the dismissal.
 *
 * For account deletion, not for signing out. Erasing an account must not leave
 * the next visitor a note about how its owner used to sign in, and the device
 * should meet the next person as a stranger in every respect.
 */
export function forgetSignInMethod(): void {
  setStored('')
  setDismissed('')
}

/** How the affordance names the method, in a sentence somebody reads. */
export function signInMethodLabel(method: SignInMethod): string {
  switch (method) {
    case 'passkey':
      return 'Sign in with your passkey'
    case 'google':
      return 'Continue with Google'
    case 'emailcode':
      return 'Email me a code'
    case 'password':
      return 'Sign in'
  }
}
