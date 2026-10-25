// Reusable modal focus management for SolidJS dialogs.
//
// While `isOpen()` is true it: moves focus into the dialog, cycles Tab/Shift+Tab
// within it (so focus can't escape to the obscured page behind), closes on
// Escape, and restores focus to the previously-focused element on close.
//
// Usage:
//   let dialogRef: HTMLDivElement | undefined
//   useFocusTrap(() => dialogRef, { isOpen: () => props.isOpen, onClose: props.close })
//   // <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="...">

import { createEffect, onCleanup } from 'solid-js'

interface FocusTrapOptions {
  isOpen: () => boolean
  onClose?: () => void
  /**
   * Keep every key inside the dialog, so document/window shortcuts cannot act
   * on the obscured screen: pass `isolateKeys` from
   * src/lib/keyboard-isolation.ts, which says what that takes of the root. Use
   * only when the dialog has no Solid-delegated keyboard handlers of its own;
   * native controls still behave normally. Read as the trap opens.
   */
  isolateKeyboard?: KeyboardIsolation
  /**
   * Element to focus when the dialog opens, instead of the first focusable
   * descendant. Use for dialogs whose leading control has an activation
   * side-effect — e.g. a bottom sheet whose first row is a native `<select>`,
   * which some mobile browsers pop open when it's programmatically focused
   * within the user-activation window. Give that element `tabindex="-1"` and
   * return it here. Falls back to the first focusable element when omitted or
   * when it resolves to nothing, so existing callers are unaffected.
   */
  initialFocus?: () => HTMLElement | undefined
}

// The trap is on Drum Night's first paint, whose bytes are budgeted
// (scripts/assert-drum-night-bundle.mjs): the selector is one string, and
// every focus the trap moves shares one options object.
const FOCUSABLE_SELECTOR =
  'a[href],' +
  'button:not([disabled]),' +
  'input:not([disabled]),' +
  'select:not([disabled]),' +
  'textarea:not([disabled]),' +
  'audio[controls],' +
  'video[controls],' +
  'details > summary:first-of-type,' +
  '[contenteditable="true"],' +
  '[tabindex]'

/** Moving the focus never scrolls, so a tall sheet is not yanked into view. */
const NO_SCROLL: FocusOptions = { preventScroll: true }

function isRendered(element: HTMLElement, root: HTMLElement): boolean {
  // Native summaries are tab stops even in DOM implementations that report
  // tabIndex=-1 by default. An explicit negative tabindex still opts out.
  const nativeSummary =
    element.matches('details > summary:first-of-type') &&
    !element.hasAttribute('tabindex')
  if (
    (element.tabIndex < 0 && !nativeSummary) ||
    element.matches(':disabled') ||
    element.closest('[hidden], [inert], [aria-hidden="true"]')
  ) {
    return false
  }

  let current: HTMLElement | null = element
  while (current !== null) {
    if (current instanceof HTMLDetailsElement && !current.open) {
      const summary = current.querySelector(':scope > summary')
      if (summary === null || !summary.contains(element)) return false
    }
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (current === root) return true
    current = current.parentElement
  }
  return false
}

/**
 * Keeps an open trap's keys inside its root (see keyboard-isolation.ts) and
 * returns its teardown. It is set up before the trap's own key handler, so it
 * hears a key before an Escape there closes the dialog and takes it away.
 */
export type KeyboardIsolation = (
  root: HTMLElement,
  focusable: () => HTMLElement[],
) => () => void

export function useFocusTrap(
  getRoot: () => HTMLElement | undefined,
  opts: FocusTrapOptions,
): void {
  let lastFocused: HTMLElement | null = null

  createEffect(() => {
    if (!opts.isOpen()) return
    const root = getRoot()
    if (!root) return

    lastFocused = document.activeElement as HTMLElement | null

    const focusable = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => isRendered(element, root),
      )
    let focusWithinDialog: HTMLElement | undefined

    // Defer initial focus until the dialog's children have mounted.
    queueMicrotask(() =>
      (opts.initialFocus?.() ?? focusable()[0])?.focus(NO_SCROLL),
    )

    const onKeyDown = (e: KeyboardEvent): void => {
      const eventModal =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('[aria-modal="true"]')
          : null
      if (eventModal !== null && eventModal !== root) return

      if (e.key === 'Escape') {
        e.preventDefault()
        opts.onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) {
        e.preventDefault()
        root.focus(NO_SCROLL)
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      // The root is not one of its own stops. A dialog that can take the
      // focus itself (tabindex -1) gets it from a press on its words, and
      // from there Shift+Tab went back to the page behind.
      const inCycle = active !== root && root.contains(active)
      if (e.shiftKey && (active === first || !inCycle)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inCycle)) {
        e.preventDefault()
        first.focus()
      }
    }

    const onFocusIn = (e: FocusEvent): void => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (root.contains(target)) {
        focusWithinDialog = target
        return
      }

      // A nested modal can be portalled outside this root. Its own focus trap
      // owns focus until it closes, so the parent must not pull focus back.
      if (target.closest('[aria-modal="true"]') !== null) return

      queueMicrotask(() => {
        if (root.contains(document.activeElement)) return
        const fallback =
          focusWithinDialog !== undefined && isRendered(focusWithinDialog, root)
            ? focusWithinDialog
            : focusable()[0]
        ;(fallback ?? root).focus(NO_SCROLL)
      })
    }

    const isolation = opts.isolateKeyboard?.(root, focusable)
    root.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    onCleanup(() => {
      isolation?.()
      root.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      if (lastFocused?.isConnected === true) {
        lastFocused.focus(NO_SCROLL)
      }
    })
  })
}
