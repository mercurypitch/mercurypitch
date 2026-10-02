// Adventure dialog focus — keyboard focus stays with the visible decision.
export function focusDialog(element: HTMLElement): void {
  queueMicrotask(() => {
    if (!element.isConnected) return
    const initial =
      element.querySelector<HTMLButtonElement>(
        'button[data-dialog-initial-focus]:not(:disabled)',
      ) ?? element.querySelector<HTMLButtonElement>('button:not(:disabled)')
    initial?.focus({ preventScroll: true })
  })
}

function isInsideClosedDetails(control: HTMLElement): boolean {
  let details = control.closest('details:not([open])')
  while (details !== null) {
    // Closed details can retain layout rectangles. Only its first direct
    // summary remains visible, and an outer closed details can still hide it.
    const summary = Array.from(details.children).find(
      (child) => child.tagName === 'SUMMARY',
    )
    if (summary?.contains(control) !== true) return true
    details = details.parentElement?.closest('details:not([open])') ?? null
  }
  return false
}

export function trapDialogKeys(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const element = event.currentTarget as HTMLElement
  const controls = Array.from(
    element.querySelectorAll<HTMLElement>(
      'button:not(:disabled), summary, a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ).filter(
    (control) =>
      control.tabIndex >= 0 &&
      control.getClientRects().length > 0 &&
      !control.closest('[inert]') &&
      !isInsideClosedDetails(control),
  )
  if (controls.length === 0) return
  const first = controls[0]
  const last = controls.at(-1)!
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      !element.contains(document.activeElement))
  ) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
