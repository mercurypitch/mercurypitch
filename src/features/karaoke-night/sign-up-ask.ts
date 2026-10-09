// ============================================================
// Karaoke Night — asking the account chip for its sign-up form
// ============================================================
//
// The rail's launch gift button (KaraokeGiftLine) and the account chip
// (KaraokeAccount) are separate lazy chunks on this page, and only the chip
// holds the form. A pending ask in a module both import is the whole
// contract: the chip opens "Create your account" whenever one is waiting,
// including one made before its chunk had loaded.

import { createSignal } from 'solid-js'

const [signUpAsked, setSignUpAsked] = createSignal(false)

export { signUpAsked }

/** Ask for the chip's form, on its "Create your account" pane. */
export function askForSignUp(): void {
  setSignUpAsked(true)
}

/** The chip has opened the form: the ask is answered. */
export function answerSignUpAsk(): void {
  setSignUpAsked(false)
}
