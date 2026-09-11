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
 * Answers one back press. `true` means it was dealt with; `false` hands the
 * press back, and the app minimizes.
 */
export type ShellBackHandler = () => boolean

let shellBack: ShellBackHandler | null = null

/**
 * Give the shell first refusal on every back press, and get the way to take
 * it away again.
 *
 * The order the shell applies is its own (`shell/shell-navigation.ts`):
 * close the tab column, then the alert, then the sheet, then the pushed
 * screen, then leave the room — and only a press that reaches the root falls
 * through to here and minimizes. Android's hardware button and the room
 * header's Back are the same press and must not disagree, which is why there
 * is one registry rather than a second handler.
 */
export function registerShellBackHandler(
  handler: ShellBackHandler,
): () => void {
  shellBack = handler
  return () => {
    if (shellBack === handler) shellBack = null
  }
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
  // COMING BACK IS NOT WIRED HERE, and it is not always the next tap either.
  // `packages/audio-io` follows the page as well: a WebView the OS takes away
  // usually fires `visibilitychange` too, and where that handler is the one
  // that parked the clock — or where iOS moved the context to 'interrupted' —
  // it resumes quietly on the way back in, for as long as a room still holds
  // a lease. Where it did not, because nobody holds a lease or this line got
  // there first, the next gesture's `unlock()` returns the sound. That is the
  // only resume iOS accepts anyway, so there is nothing to add on this side.
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
  // The shell answers first when it is up (`registerShellBackHandler`): it
  // owns the tab column, the More sheet, the Keep alert and the pushed
  // Settings screen, and each of those has to close before a press means
  // "leave the room". A press it declines is one that reached the root, and
  // the root's answer is to minimize rather than exit — Capacitor's default
  // would lose whatever was open. Without a shell (a test, or boot before the
  // first render) history depth is still the whole of it.
  const stopBack = onBackButton(() => {
    if (shellBack !== null) {
      if (shellBack()) return
      void minimizeApp()
      return
    }
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
