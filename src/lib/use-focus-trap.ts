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
  '[contenteditable="true"]',
  '[tabindex]',
].join(',')

function isRendered(element: HTMLElement, root: HTMLElement): boolean {
  if (
    element.tabIndex < 0 ||
    element.matches(':disabled') ||
    element.closest('[hidden], [inert], [aria-hidden="true"]')
  ) {
    return false
  }

  let current: HTMLElement | null = element
  while (current !== null) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (current === root) return true
    current = current.parentElement
  }
  return false
}

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
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
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
          focusWithinDialog !== undefined && root.contains(focusWithinDialog)
            ? focusWithinDialog
            : focusable()[0]
        ;(fallback ?? root).focus({ preventScroll: true })
      })
    }

    root.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    onCleanup(() => {
      root.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      if (lastFocused?.isConnected === true) {
        lastFocused.focus({ preventScroll: true })
      }
    })
  })
}
