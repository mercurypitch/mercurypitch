// ============================================================
// What's New — open state, and the once-per-release announcement
// ============================================================
//
// Keeps App.tsx to three lines: a controller, an effect it already runs,
// and one <Show>. The decision of WHETHER to announce is pure and tested
// next door (whats-new-release.ts); this is the storage and the timing.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { APP_VERSION } from '@/lib/defaults'
import { navigateTo, parseHash } from '@/lib/hash-router'
import { releaseLine, shouldAnnounce, WHATS_NEW_SEEN_KEY, } from './whats-new-release'

export interface WhatsNewController {
  open: Accessor<boolean>
  setOpen: (open: boolean) => void
  /** Open it deliberately (the sidebar entry, a deep link). */
  show: () => void
  /** Close and mark this release line as told — however it was opened. */
  close: () => void
  /**
   * Announce the release if this device has not seen this line yet. Safe to
   * call on every boot; it is a no-op after the first.
   */
  announceIfNew: (returning: boolean) => void
}

function readSeen(): string | null {
  try {
    const raw = localStorage.getItem(WHATS_NEW_SEEN_KEY)
    return raw === null || raw === '' ? null : raw
  } catch {
    // Private-mode storage refusals must not cost anybody the app.
    return null
  }
}

function writeSeen(): void {
  const line = releaseLine(APP_VERSION)
  if (line === null) return
  try {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, line)
  } catch {
    // Same: an unwritable store means it may announce again next launch,
    // which is a far smaller problem than throwing during a close.
  }
}

export function createWhatsNewController(): WhatsNewController {
  const [open, setOpen] = createSignal(
    parseHash(window.location.hash).type === 'whats-new',
  )

  const show = () => {
    // Through the router, so the page is deep-linkable and Back closes it.
    navigateTo({ type: 'whats-new' })
    setOpen(true)
  }

  const close = () => {
    // Marked on close rather than on open: a panel dismissed before it
    // rendered was never actually read, but one closed by any route out of
    // it — button, Escape, Back — was.
    writeSeen()
    setOpen(false)
  }

  const announceIfNew = (returning: boolean) => {
    if (
      !shouldAnnounce({ current: APP_VERSION, seen: readSeen(), returning })
    ) {
      // A first-ever visitor is caught up by definition: record the line so
      // their first announcement is the next real release, not this one.
      if (!returning) writeSeen()
      return
    }
    // Through the router, exactly like the sidebar entry — NOT by setting
    // the signal. The router owns this surface: its boot dispatch writes
    // `false` for any hash that is not /whats-new, so a signal set during
    // mount was closed again a tick later. Going through the hash also
    // means Back dismisses the announcement and returns the visitor to the
    // page they actually opened.
    show()
  }

  return { open, setOpen, show, close, announceIfNew }
}
