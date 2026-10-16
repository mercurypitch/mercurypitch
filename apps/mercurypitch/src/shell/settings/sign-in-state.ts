// ============================================================
// The sign-in sheet's open state, and what Back does to it
// ============================================================
//
// Module-level so the things that reach the sheet agree on it: the Account
// screen's button, every in-app "Sign in" (ui-store's openAuthModal, which
// the shell answers with openSignIn), Keep's "Use email", and Back, which
// has to close the sheet before it pops the screen underneath
// (shell-navigation.ts).
//
// The sheet owns its panes. Back asks it first, through the handler it
// registers, so a press on the code pane steps back to the address rather
// than throwing the half-finished sign-in away.

import { createSignal } from 'solid-js'

const [signInOpen, setSignInOpen] = createSignal(false)

/** Whether the sign-in sheet is up. */
export { signInOpen }

let paneBack: (() => boolean) | null = null

/** The pane the next open starts on, when its caller asked for one. */
let startOn: 'email' | null = null

export function openSignIn(): void {
  startOn = null
  setSignInOpen(true)
}

/**
 * Open the sheet on its email pane: Keep's "Use email" (S7b §3.5), which
 * has already offered Apple and Google. Back from there is the sheet's own
 * ways in, as from any pane.
 */
export function openSignInByEmail(): void {
  startOn = 'email'
  setSignInOpen(true)
}

/** The pane this open asked for, once; null for the ways in. */
export function takeSignInStartPane(): 'email' | null {
  const pane = startOn
  startOn = null
  return pane
}

export function closeSignIn(): void {
  setSignInOpen(false)
}

/**
 * Back, while the sheet is up: one pane back if the sheet has one to go back
 * to, and closed if it is on its first.
 */
export function signInBack(): void {
  if (paneBack?.() === true) return
  closeSignIn()
}

/**
 * The sheet's own step back. Returns true when it moved a pane, false when it
 * was already on its first. Registration returns its own unregister.
 */
export function registerSignInPaneBack(handler: () => boolean): () => void {
  paneBack = handler
  return () => {
    if (paneBack === handler) paneBack = null
  }
}

/** Tests: closed, with no pane handler and no pane asked for. */
export function resetSignIn(): void {
  setSignInOpen(false)
  paneBack = null
  startOn = null
}
