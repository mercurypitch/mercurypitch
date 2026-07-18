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
  '[tabindex]:not([tabindex="-1"])',
].join(',')

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
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    // Defer initial focus until the dialog's children have mounted.
    // preventScroll keeps a tall sheet from being yanked into view on open.
    queueMicrotask(() =>
      (opts.initialFocus?.() ?? focusable()[0])?.focus({ preventScroll: true }),
    )

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        opts.onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    root.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      root.removeEventListener('keydown', onKeyDown)
      lastFocused?.focus?.()
    })
  })
}
