// Keeping the keys inside a modal: what `isolateKeyboard` adds to useFocusTrap.
//
// A trap given `isolateKeys` stops every key at its root, so neither the
// document's nor the window's bubble-phase shortcuts act on the screen behind.
// The stop holds only for a key sent from inside the root, so the focus has to
// stay inside too:
// - The root takes the focus from a press on its words only with
//   `tabindex="-1"`. Without it, a press where no control takes the focus
//   drops it to the body, and every key after that is heard by the app behind.
//   The root is not one of its own Tab stops, so this changes neither the Tab
//   cycle nor where focus opens.
// - The focus can fall to the body without a press, too: a field blurs itself
//   to put a phone's keyboard away, and a control that goes, or is disabled,
//   takes the focus with it. The trap takes it back onto the root, which opens
//   no keyboard, unless the dialog moves it on first.
// - A capture-phase listener on the window or document still runs first and
//   hears every key. Such a listener must yield to `[role="dialog"]`, as
//   `isInsideOverlay` does in src/lib/space-playback.ts.
//
// It is a module of its own, not part of use-focus-trap.ts, because rooms load
// the trap on their first paint and most never isolate a key: Drum Night's
// first paint has a byte budget (scripts/assert-drum-night-bundle.mjs).

import type { KeyboardIsolation } from './use-focus-trap'

const MODAL = '[aria-modal="true"]'

/** Pass as useFocusTrap's `isolateKeyboard`. */
export const isolateKeys: KeyboardIsolation = (root, focusable) => {
  // A key sent from a modal nested in this one is that modal's to keep.
  const stop = (e: KeyboardEvent): void => {
    const modal = e.target instanceof Element ? e.target.closest(MODAL) : null
    if (modal === null || modal === root) e.stopPropagation()
  }

  // A dialog opened over this one, nested in it or portalled out of it, holds
  // the focus while it is open, and a focus that falls from there is its own.
  let over: Element | null = null
  const onFocusIn = (e: FocusEvent): void => {
    const modal = e.target instanceof Element ? e.target.closest(MODAL) : null
    over =
      modal !== null && modal !== root && root.contains(modal) ? modal : null
  }

  // Both ways the focus falls are caught: a blur says where it went (nowhere),
  // and a removed or disabled control says nothing, so the root is watched for
  // those. Both act a microtask later (the observer delivers in one), so a
  // dialog that moves the focus on itself does so first.
  const takeBack = (): void => {
    if (over?.isConnected === true || !root.isConnected) return
    const active = document.activeElement
    if (active !== null && active !== document.body) return
    if (root.hasAttribute('tabindex')) root.focus({ preventScroll: true })
    else focusable()[0]?.focus({ preventScroll: true })
  }
  const onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget
    if (next === null) queueMicrotask(takeBack)
    else if (next instanceof Element && !root.contains(next)) {
      over = next.closest(MODAL)
    }
  }
  const watch = new MutationObserver(takeBack)
  watch.observe(root, {
    childList: true,
    subtree: true,
    attributeFilter: ['disabled', 'hidden', 'inert'],
  })

  root.addEventListener('keydown', stop)
  root.addEventListener('focusin', onFocusIn)
  root.addEventListener('focusout', onFocusOut)
  return () => {
    watch.disconnect()
    root.removeEventListener('keydown', stop)
    root.removeEventListener('focusin', onFocusIn)
    root.removeEventListener('focusout', onFocusOut)
  }
}
