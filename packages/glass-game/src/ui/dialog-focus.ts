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
  const buttons = Array.from(
    element.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], [tabindex="0"]',
    ),
  )
  if (buttons.length === 0) return
  const first = buttons[0]
  const last = buttons.at(-1)!
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
