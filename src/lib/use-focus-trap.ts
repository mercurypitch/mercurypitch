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
   * Stop every key at the modal root so document/window shortcuts cannot act
   * on the obscured screen. Use only when the dialog has no Solid-delegated
   * keyboard handlers of its own; native controls still behave normally.
   *
   * The stop is half of what keeps the keys in. It holds only for a key sent
   * from inside the root, and only in the bubble phase:
   * - The root must take focus from a press: give it `tabindex="-1"`. A press
   *   on its words, where no control takes the focus, drops it to the body
   *   otherwise, and every key after that is heard by the app behind again.
   *   The root is not one of its own Tab stops, so this changes neither the
   *   Tab cycle nor where focus opens.
   * - The focus can fall to the body without a press, too: a field blurs
   *   itself to put a phone's keyboard away, and a control that goes, or is
   *   disabled, takes the focus with it. The topmost trap takes it back onto
   *   the root, which opens no keyboard, unless the dialog moves it on first.
   * - A capture-phase listener on the window or document still runs first and
   *   hears every key. Such a listener must yield to `[role="dialog"]`, as
   *   `isInsideOverlay` does in src/lib/space-playback.ts.
   */
  isolateKeyboard?: boolean
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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'audio[controls]',
  'video[controls]',
  'details > summary:first-of-type',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',')

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

/** The open traps' roots, the last opened last: the topmost owns a fallen focus. */
const openRoots: HTMLElement[] = []

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
    // preventScroll keeps a tall sheet from being yanked into view on open.
    queueMicrotask(() =>
      (opts.initialFocus?.() ?? focusable()[0])?.focus({ preventScroll: true }),
    )

    const onKeyDown = (e: KeyboardEvent): void => {
      const eventModal =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('[aria-modal="true"]')
          : null
      if (eventModal !== null && eventModal !== root) return

      if (opts.isolateKeyboard === true) e.stopPropagation()

      if (e.key === 'Escape') {
        e.preventDefault()
        opts.onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) {
        e.preventDefault()
        root.focus({ preventScroll: true })
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
        ;(fallback ?? root).focus({ preventScroll: true })
      })
    }

    // A focus that fell to the body leaves no target inside the root, so the
    // stop at the root never hears the keys after it (isolateKeyboard). Both
    // ways it falls are caught: a blur says where focus went (nowhere), and a
    // removed or disabled control says nothing, so the root is watched for
    // those. Both act a microtask later (the observer delivers in one), so a
    // dialog that moves the focus on itself does so first.
    const takeBackFocus = (): void => {
      if (opts.isolateKeyboard !== true) return
      if (openRoots[openRoots.length - 1] !== root || !root.isConnected) return
      const active = document.activeElement
      if (active !== null && active !== document.body) return
      if (root.hasAttribute('tabindex')) root.focus({ preventScroll: true })
      else focusable()[0]?.focus({ preventScroll: true })
    }
    const onFocusOut = (e: FocusEvent): void => {
      if (e.relatedTarget === null) queueMicrotask(takeBackFocus)
    }
    const watch = new MutationObserver(takeBackFocus)
    watch.observe(root, {
      childList: true,
      subtree: true,
      attributeFilter: ['disabled', 'hidden', 'inert'],
    })

    openRoots.push(root)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('focusout', onFocusOut)
    document.addEventListener('focusin', onFocusIn)
    onCleanup(() => {
      openRoots.splice(openRoots.lastIndexOf(root), 1)
      watch.disconnect()
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('focusin', onFocusIn)
      if (lastFocused?.isConnected === true) {
        lastFocused.focus({ preventScroll: true })
      }
    })
  })
}
