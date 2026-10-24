// ============================================================
// Keys at a focus trap: what the app behind a layer hears
// ============================================================
//
// A modal layer that traps focus with `isolateKeyboard` has to keep its keys
// from the app's shortcuts, which listen on `window` (useKeyboardShortcuts).
// The tests that pin this (First Light, the plan layer, and First Light's
// focus containment) share three things: the keys it would hurt most to let
// through, a window listener that records what gets out, and the pointer
// press that jsdom does not answer.

import { fireEvent } from '@solidjs/testing-library'

/**
 * The three keys the app's shortcuts act on that would hurt most behind a
 * layer: play or pause, the microphone, and stop. The app reads `code`; a
 * layer's own handlers read `key`.
 */
export const APP_KEYS = [
  { key: ' ', code: 'Space' },
  { key: 'm', code: 'KeyM' },
  { key: 'Escape', code: 'Escape' },
] as const

let ears = new AbortController()

/**
 * Starts listening for keydowns on `window`, as the app's shortcuts do, and
 * returns what it hears, in order: each key by its `code`, which is what the
 * app reads, or by its `key` for a case that sends no `code`. Stop listening
 * with `stopOverhearing`, after each case.
 */
export function overheard(read: 'code' | 'key' = 'code'): string[] {
  const heard: string[] = []
  window.addEventListener('keydown', (e) => heard.push(e[read]), {
    signal: ears.signal,
  })
  return heard
}

/** Stops every listener `overheard` started. */
export function stopOverhearing(): void {
  ears.abort()
  ears = new AbortController()
}

/**
 * A pointer press, as a browser answers it, which jsdom does not: unless a
 * handler cancels the mousedown, focus goes to the nearest ancestor that takes
 * a press's focus (a tabindex, a button, a link, a field), and with none it
 * drops to the page, where the active element is the body.
 */
export function press(target: Element): void {
  if (!fireEvent.mouseDown(target)) return
  const takesFocus = target.closest<HTMLElement>(
    '[tabindex], button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
  )
  if (takesFocus !== null) takesFocus.focus()
  else if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}
