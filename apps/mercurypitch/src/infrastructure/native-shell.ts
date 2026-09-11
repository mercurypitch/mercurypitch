// ============================================================
// Native shell wiring — the two things the OS does that a tab does not
// ============================================================
//
// A WebView is not a tab, and this module is where the two differences that
// bite on day one are answered: the app being taken away by the OS, and a
// hardware button that exits the app when nothing handles it.
//
// Both are installed once, from `main.tsx`, and both are no-ops on the web —
// the wrappers in `@irchiinnuss/mobile-runtime/platform` only reach a plugin
// inside a native platform check, so importing this file from a browser build
// costs nothing and does nothing.

import { suspendSharedAudioContext } from '@irchiinnuss/audio-io'
import { minimizeApp, onAppState, onBackButton, } from '@irchiinnuss/mobile-runtime/platform'

/** Enough of `History` to decide whether there is anywhere to go back to. */
interface HistoryLike {
  readonly length: number
  back(): void
}

function browserHistory(): HistoryLike | null {
  return typeof window === 'undefined' ? null : window.history
}

export interface NativeShellOptions {
  /** Test seam. Production reads the WebView's own history. */
  history?: HistoryLike | null
}

/**
 * Wires the app's lifecycle and the Android back button, and returns the
 * teardown for both.
 *
 * @returns a function that removes both listeners. The app never calls it —
 * the shell outlives every screen — but a test does, and a listener with no
 * way off is the shape this repository has been bitten by before.
 */
export function installNativeShell(
  options: NativeShellOptions = {},
): () => void {
  const history =
    options.history === undefined ? browserHistory() : options.history

  // WHY THE APP-STATE EVENT AND NOT `visibilitychange`. The page's own
  // visibility event is the WebView answering a question about the document;
  // this is the OS answering one about the app, and they disagree exactly
  // where it matters — a call arriving, the app switcher, the screen locking.
  // Owner decision: no background audio in V1, so leaving the foreground
  // stops the sound rather than ducking it.
  //
  // Coming back is deliberately not handled. iOS lifts a suspended context
  // only from inside a user gesture, so the next tap's `unlock()` is what
  // returns the clock; waking it here would be a resume the platform refuses,
  // and a silence with no explanation.
  //
  // Today this parks the one context `packages/audio-io` owns, which on this
  // app's side is nobody yet: the root rooms each build their own. They adopt
  // the shared context ROOM BY ROOM (task E2 and the R-tasks, starting with
  // `sing`), and every room that does is covered by this line from the day it
  // moves — which is why the hook goes in now rather than with the first one.
  const stopLifecycle = onAppState((state) => {
    if (state === 'background') suspendSharedAudioContext()
  })

  // Android's hardware back. Registering a handler turns Capacitor's default
  // off, and its default is to exit the app — so this has to answer for every
  // press, including the one with nowhere to go.
  //
  // PHASE 1 REPLACES THIS. The shell being built there owns sheets and a tab
  // stack, and back has to close the sheet, then leave the room, then exit
  // (plan task G2). Until those exist there is nothing to ask, so history
  // depth is the whole of it.
  const stopBack = onBackButton(() => {
    if (history !== null && history.length > 1) {
      history.back()
      return
    }
    void minimizeApp()
  })

  return () => {
    stopLifecycle()
    stopBack()
  }
}
