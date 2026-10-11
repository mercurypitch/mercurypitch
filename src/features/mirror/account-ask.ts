// ============================================================
// Voice Mirror — who is offered an account, and the ask's state
// ============================================================
//
// The owner's rule (maff, 11 Oct 2026): offer an account only to somebody who
// has none. Signed in, there is no ask. Without an account, it comes after the
// first voiceprint and after every later one. Signed out of an account this
// browser has met, there is no ask either: they have one already, and
// `accountKnownHere` (db/services/account-known) lists the notes that say so.
//
// The ask sits under the results (MirrorAccountAsk). The dialog it opens is a
// chunk of its own (MirrorAccountHost), loaded when somebody taps the ask or
// when a Google sign-in started from it lands back on this page. This module
// is what the two share, and nothing in it loads the dialog.

import { createSignal } from 'solid-js'
import { accountKnownHere } from '@/db/services/account-known'
import type { GoogleRedirectResult } from '@/db/services/auth-service'
import { googleTwofaPending, takeGoogleRedirectResult, } from '@/db/services/auth-service'

/** The rule. Reactive: a sign-in on this page takes the ask away at once. */
export function asksForAccount(): boolean {
  return !accountKnownHere()
}

/** What a Google return said as it landed on this page. */
export type GoogleLanding =
  | { kind: 'result'; result: GoogleRedirectResult }
  /** The account has a second factor: no session yet, a code to type. */
  | { kind: 'second-factor' }

const [asked, setSignUpAsked] = createSignal(false)
const [wanted, setHostWanted] = createSignal(false)
const [failed, setHostFailed] = createSignal(false)
let landing: GoogleLanding | null = null

/** The ask was tapped and the dialog has not opened for it yet. */
export const signUpAsked = asked
/** Something needs the dialog's chunk: a tap, or a Google return. */
export const hostWanted = wanted
/** The dialog's chunk did not load, so the ask says so. */
export const hostFailed = failed

/** The ask was tapped: load the dialog and open it on "Create your account". */
export function askForAccount(): void {
  setHostFailed(false)
  setSignUpAsked(true)
  setHostWanted(true)
}

/** The dialog has opened for the ask. */
export function answerAccountAsk(): void {
  setSignUpAsked(false)
}

/** The chunk failed (offline, or a deploy replaced it): stand down. */
export function hostDidNotLoad(): void {
  setSignUpAsked(false)
  setHostWanted(false)
  setHostFailed(true)
}

/**
 * Take what a Google return said, once. The entry calls it after the return
 * is stored (consumeGoogleRedirect) and before the page renders. A return
 * loads the dialog's chunk: its toast says how the sign-in went, and a second
 * factor still owed opens the dialog on the code pane. Without that, the
 * sign-in would end in silence, with nothing on the page asking for the code.
 */
export function takeGoogleLanding(): void {
  const result = takeGoogleRedirectResult()
  if (result !== null) {
    landing = { kind: 'result', result }
  } else if (googleTwofaPending()) {
    landing = { kind: 'second-factor' }
  } else {
    return
  }
  setHostWanted(true)
}

/** The landing, for the dialog's host to act on. One-shot. */
export function takeLanding(): GoogleLanding | null {
  const taken = landing
  landing = null
  return taken
}

/** Back to a page nobody has touched: for tests that share this module. */
export function resetAccountAskForTests(): void {
  setSignUpAsked(false)
  setHostWanted(false)
  setHostFailed(false)
  landing = null
}
