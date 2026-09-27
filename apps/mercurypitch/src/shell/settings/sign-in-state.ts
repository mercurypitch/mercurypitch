// ============================================================
// The sign-in sheet's open state, and what Back does to it
// ============================================================
//
// Module-level so the three things that reach the sheet agree on it: the
// Account screen's button, every in-app "Sign in" (ui-store's openAuthModal,
// which the shell answers with openSignIn), and Back, which has to close the
// sheet before it pops the screen underneath (shell-navigation.ts).
//
// The sheet owns its panes. Back asks it first, through the handler it
// registers, so a press on the code pane steps back to the address rather
// than throwing the half-finished sign-in away.

import { createSignal } from 'solid-js'

const [signInOpen, setSignInOpen] = createSignal(false)

/** Whether the sign-in sheet is up. */
export { signInOpen }

let paneBack: (() => boolean) | null = null

export function openSignIn(): void {
  setSignInOpen(true)
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

/** Tests: closed, with no pane handler. */
export function resetSignIn(): void {
  setSignInOpen(false)
  paneBack = null
}
