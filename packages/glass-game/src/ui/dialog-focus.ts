// Adventure dialog focus — keyboard focus stays with the visible decision.
export function focusDialog(element: HTMLElement): void {
  queueMicrotask(() => {
    if (element.isConnected)
      element
        .querySelector<HTMLButtonElement>('button')
        ?.focus({ preventScroll: true })
  })
}
export function trapDialogKeys(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const element = event.currentTarget as HTMLElement
  const controls = Array.from(
    element.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ).filter(
    (control) =>
      control.tabIndex >= 0 &&
      control.getClientRects().length > 0 &&
      !control.closest('[inert]'),
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
