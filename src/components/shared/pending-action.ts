// "Working on it" as state, including the case where the work is leaving.
// ============================================================
//
// Two kinds of wait wear the same spinner and need different endings:
//
//   - An async handler: pending for as long as the promise is unsettled.
//   - A navigation to another document (/guitar-night, /karaoke-night,
//     /mirror are separate entry points): pending until this page goes away.
//     Nothing here resolves that, so it has to be bounded from the outside —
//     the browser restoring this page from the back/forward cache must clear
//     it, or the user returns to a button that has been spinning since they
//     left, and a stalled navigation must clear it too rather than leave the
//     control disabled forever.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'

export interface PendingAction {
  pending: Accessor<boolean>
  /** Start waiting. Safe to call again while already pending. */
  begin(): void
  /** Stop waiting. */
  end(): void
  /** Wait for as long as `work` takes, whatever it settles as. */
  run<T>(work: () => Promise<T> | T): Promise<T>
}

/** Long enough that a slow page still feels answered, short enough to recover. */
const DEFAULT_TIMEOUT_MS = 20_000

export function createPendingAction(
  options: { timeoutMs?: number } = {},
): PendingAction {
  const [pending, setPending] = createSignal(false)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = (): void => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  const end = (): void => {
    clearTimer()
    setPending(false)
  }

  const begin = (): void => {
    clearTimer()
    setPending(true)
    if (timeoutMs > 0) timer = setTimeout(end, timeoutMs)
  }

  if (typeof window !== 'undefined') {
    // `pageshow` fires on a normal load and on a back/forward-cache restore;
    // either way this document is being looked at again, so nothing it was
    // waiting for is still in flight.
    const onShow = (): void => end()
    window.addEventListener('pageshow', onShow)
    onCleanup(() => window.removeEventListener('pageshow', onShow))
  }
  onCleanup(clearTimer)

  return {
    pending,
    begin,
    end,
    async run(work) {
      begin()
      try {
        return await work()
      } finally {
        end()
      }
    },
  }
}

/**
 * Whether this click is the one that replaces the current page. A modified
 * click or a `_blank` target opens somewhere else and leaves this document
 * exactly where it is, so it must not arm a spinner that nothing will clear.
 */
export function clickNavigatesThisPage(
  event: MouseEvent,
  target?: string,
): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false
  }
  return target === undefined || target === '' || target === '_self'
}
