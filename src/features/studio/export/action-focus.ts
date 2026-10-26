// Studio finishing action focus — async button replacements keep keyboard users inside their task.
export async function runStudioPanelAction(
  button: HTMLButtonElement,
  action: () => Promise<boolean>,
): Promise<void> {
  const host = button.closest<HTMLElement>('[data-studio-finishing-actions]')
  const startedWithFocus = document.activeElement === button

  function restore(): void {
    if (!startedWithFocus || host?.isConnected !== true) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    host
      .querySelector<HTMLButtonElement>(
        '[data-studio-finishing-action]:not(:disabled)',
      )
      ?.focus()
  }
  const pending = action()
  queueMicrotask(restore)
  try {
    await pending
  } finally {
    queueMicrotask(restore)
  }
}
